import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../core/supabase';
import { Swatch } from './Swatch';
import { tr } from './i18n';
const BUCKET = 'project-uploads';
const asArr = (v) => (Array.isArray(v) ? v : []);
/** Vertaling van een vraag of module (kolom i18n in Supabase); Nederlands als die ontbreekt. */
const loc = (x, lang) => (lang === 'nl' ? {} : x.i18n?.[lang] ?? {});
/** Vragenlijst voor de klant (ook door de beheerder te openen). Bewaart tussentijds; indienen zet het project op "Vragenlijst". */
export function Survey({ code, lang = 'nl', onClose }) {
    const t = tr(lang);
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [answers, setAnswers] = useState({});
    const [step, setStep] = useState(0);
    const [saved, setSaved] = useState('');
    const [missing, setMissing] = useState([]);
    const [done, setDone] = useState(false);
    const timer = useRef(undefined);
    useEffect(() => {
        supabase.rpc('portal_survey', { p_code: code }).then(({ data, error }) => {
            if (error)
                return setErr(error.message);
            const d = data;
            setData(d);
            setAnswers({ telefoon: d.known.phone ?? '', werf_straat: d.known.street ?? '', werf_postcode: d.known.postal_code ?? '', werf_gemeente: d.known.city ?? '', ...d.answers });
        });
    }, [code]);
    const save = useCallback(async (a, submit = false) => {
        setSaved(t.saving);
        const { error } = await supabase.rpc('portal_save_survey', { p_code: code, p_answers: a, p_submit: submit });
        setSaved(error ? t.notSaved(error.message) : t.saved);
        return !error;
    }, [code, t]);
    const set = (key, value) => {
        setAnswers((prev) => {
            const next = { ...prev, [key]: value };
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => save(next), 1200);
            return next;
        });
    };
    // secties: algemene secties in volgorde, daarna één per gekozen projecttype
    const sections = useMemo(() => {
        if (!data)
            return [];
        const chosen = asArr(answers.projecttype);
        const out = [];
        for (const q of data.questions.filter((q) => q.module === 'algemeen')) {
            let s = out.find((x) => x.title === q.section);
            if (!s)
                out.push((s = { title: q.section, name: loc(q, lang).section ?? q.section, qs: [] }));
            s.qs.push(q);
        }
        const general = out.splice(0);
        const mods = data.modules.filter((m) => m.module !== 'algemeen' && chosen.includes(m.label));
        const modSections = mods.map((m) => ({ title: m.label, name: loc(m, lang).label ?? m.label, intro: loc(m, lang).intro ?? m.intro, qs: data.questions.filter((q) => q.module === m.module) }));
        // projectspecifieke vragen na "Stijl en materiaal", vóór "Praktisch"
        const i = general.findIndex((s) => s.title === 'Praktisch');
        return i < 0 ? [...general, ...modSections] : [...general.slice(0, i), ...modSections, ...general.slice(i)];
    }, [data, answers.projecttype, lang]);
    if (err)
        return _jsxs("div", { className: "portal-empty", children: [_jsx("h2", { children: t.surveyLoadErr }), _jsx("p", { children: err }), _jsx("button", { onClick: onClose, children: t.back })] });
    if (!data)
        return _jsx("p", { className: "muted", children: t.loading });
    const readOnly = data.status === 'submitted';
    if (done)
        return (_jsxs("div", { className: "survey-done", children: [_jsx("h2", { children: t.thanks }), _jsx("p", { children: t.thanksText }), _jsx("button", { className: "primary", onClick: onClose, children: t.backToProject })] }));
    const sec = sections[Math.min(step, sections.length - 1)];
    const isEmpty = (q) => {
        const v = answers[q.key];
        if (q.type === 'upload')
            return asArr(v).length === 0;
        if (q.type === 'multi' || q.type === 'tiles')
            return asArr(v).length === 0;
        return v === undefined || v === null || String(v).trim() === '';
    };
    const submit = async () => {
        const miss = sections.flatMap((s) => s.qs.filter((q) => q.required && isEmpty(q)).map((q) => `${s.name}: ${loc(q, lang).label ?? q.label}`));
        setMissing(miss);
        if (miss.length)
            return;
        window.clearTimeout(timer.current);
        if (await save(answers, true))
            setDone(true);
    };
    const last = step >= sections.length - 1;
    return (_jsxs("div", { className: "survey", children: [_jsxs("div", { className: "survey-head", children: [_jsx("button", { className: "link", onClick: onClose, children: t.backArrow }), _jsx("span", { className: "muted small", children: readOnly ? t.readOnly : saved })] }), _jsx("h1", { children: t.survey }), _jsxs("p", { className: "muted", children: [t.surveyIntro, " ", _jsx("strong", { children: t.surveyIntroStrong }), " ", t.surveyIntroEnd] }), _jsx("ol", { className: "survey-steps", children: sections.map((s, i) => (_jsx("li", { className: i === step ? 'now' : i < step ? 'done' : '', children: _jsx("button", { onClick: () => setStep(i), children: s.name }) }, s.title))) }), _jsxs("section", { className: "survey-section", children: [_jsx("h2", { children: sec.name }), sec.intro && _jsx("p", { className: "muted", children: sec.intro }), sec.qs.map((q) => (_jsx(Field, { q: q, lang: lang, code: code, value: answers[q.key], answers: answers, readOnly: readOnly, onChange: (v) => set(q.key, v) }, q.key)))] }), missing.length > 0 && (_jsxs("div", { className: "auth-msg error", children: [t.stillMissing, " ", _jsx("ul", { children: missing.map((m) => _jsx("li", { children: m }, m)) })] })), _jsxs("div", { className: "survey-nav", children: [step > 0 ? _jsx("button", { onClick: () => setStep(step - 1), children: t.prev }) : _jsx("span", {}), !last ? (_jsx("button", { className: "primary", onClick: () => { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }, children: t.next })) : !readOnly ? (_jsx("button", { className: "primary", onClick: submit, children: t.submit })) : null] })] }));
}
function Field({ q, lang, code, value, answers, readOnly, onChange }) {
    // vervolgvragen enkel tonen als ze relevant zijn
    if (q.key === 'bron_wie' && answers.bron !== 'Aanbeveling van iemand')
        return null;
    if (q.key === 'deadline_wat' && answers.deadline !== true)
        return null;
    if (q.key === 'k_toestellen_info' && !answers.k_toestellen)
        return null;
    const t = tr(lang);
    const L = loc(q, lang);
    const opts = (Array.isArray(q.options) ? q.options : []);
    // getoonde tekst van een keuze (de bewaarde waarde blijft de Nederlandse)
    const optText = (i, nlText) => { const o = L.options?.[i]; return typeof o === 'string' ? o : o?.label ?? nlText; };
    const help = L.help ?? q.help;
    const label = (_jsxs("div", { className: "q-label", children: [_jsxs("span", { children: [L.label ?? q.label, q.required && _jsx("span", { className: "req", children: " *" })] }), help && _jsx("small", { children: help })] }));
    const dis = readOnly;
    switch (q.type) {
        case 'textarea':
            return _jsxs("label", { className: "q", children: [label, _jsx("textarea", { rows: 3, disabled: dis, value: String(value ?? ''), onChange: (e) => onChange(e.target.value) })] });
        case 'number':
            return _jsxs("label", { className: "q", children: [label, _jsx("input", { type: "number", disabled: dis, value: String(value ?? ''), onChange: (e) => onChange(e.target.value === '' ? null : Number(e.target.value)) })] });
        case 'yesno':
            return (_jsxs("div", { className: "q", children: [label, _jsx("div", { className: "chips-pick", children: [[t.yes, true], [t.no, false]].map(([t, v]) => (_jsx("button", { type: "button", disabled: dis, className: value === v ? 'on' : '', onClick: () => onChange(v), children: t }, String(t)))) })] }));
        case 'choice':
            return (_jsxs("div", { className: "q", children: [label, _jsx("div", { className: "chips-pick", children: opts.map((o, i) => _jsx("button", { type: "button", disabled: dis, className: value === o ? 'on' : '', onClick: () => onChange(value === o ? null : o), children: optText(i, o) }, o)) })] }));
        case 'multi': {
            const arr = asArr(value);
            return (_jsxs("div", { className: "q", children: [label, _jsx("div", { className: "chips-pick", children: opts.map((o, i) => (_jsxs("button", { type: "button", disabled: dis, className: arr.includes(o) ? 'on' : '', onClick: () => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]), children: [arr.includes(o) ? '✓ ' : '', optText(i, o)] }, o))) })] }));
        }
        case 'tiles': {
            const arr = asArr(value);
            return (_jsxs("div", { className: "q", children: [label, _jsx("div", { className: "tiles", children: opts.map((tile, i) => {
                            const o = L.options?.[i];
                            const info = (typeof o === 'object' && o?.info) || tile.info;
                            return (_jsxs("button", { type: "button", disabled: dis, className: 'tile' + (arr.includes(tile.value) ? ' on' : ''), onClick: () => onChange(arr.includes(tile.value) ? arr.filter((x) => x !== tile.value) : [...arr, tile.value]), children: [_jsx("span", { className: "tile-img", children: _jsx(Swatch, { id: tile.swatch }) }), _jsx("strong", { children: optText(i, tile.value) }), info && _jsx("small", { children: info })] }, tile.value));
                        }) })] }));
        }
        case 'upload':
            return _jsx(Upload, { q: q, t: t, code: code, paths: asArr(value), readOnly: dis, onChange: onChange, label: label });
        default:
            return _jsxs("label", { className: "q", children: [label, _jsx("input", { type: q.type === 'email' ? 'email' : q.type === 'tel' ? 'tel' : q.type === 'date' ? 'date' : 'text', disabled: dis, value: String(value ?? ''), onChange: (e) => onChange(e.target.value) })] });
    }
}
function Upload({ q, t, code, paths, readOnly, onChange, label }) {
    const [busy, setBusy] = useState(0);
    const [urls, setUrls] = useState({});
    const [msg, setMsg] = useState(null);
    const accept = q.options?.accept;
    useEffect(() => {
        const todo = paths.filter((p) => !urls[p]);
        if (!todo.length)
            return;
        supabase.storage.from(BUCKET).createSignedUrls(todo, 3600).then(({ data }) => {
            const add = {};
            for (const d of data ?? [])
                if (d.path && d.signedUrl)
                    add[d.path] = d.signedUrl;
            setUrls((u) => ({ ...u, ...add }));
        });
    }, [paths, urls]);
    const add = async (files) => {
        if (!files?.length)
            return;
        setMsg(null);
        const out = [...paths];
        for (const f of Array.from(files)) {
            setBusy((b) => b + 1);
            const safe = f.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
            const path = `${code}/${q.key}/${Date.now()}-${safe}`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false });
            setBusy((b) => b - 1);
            if (error)
                setMsg(`${f.name}: ${error.message}`);
            else
                out.push(path);
        }
        onChange(out);
    };
    const remove = async (p) => {
        await supabase.storage.from(BUCKET).remove([p]);
        onChange(paths.filter((x) => x !== p));
    };
    return (_jsxs("div", { className: "q", children: [label, _jsxs("div", { className: "uploads", children: [paths.map((p) => {
                        const isImg = /\.(jpe?g|png|webp|gif|heic)$/i.test(p);
                        return (_jsxs("div", { className: "upl", children: [isImg && urls[p] ? _jsx("img", { src: urls[p], alt: "" }) : _jsx("span", { className: "upl-file", children: p.split('.').pop()?.toUpperCase() }), _jsx("a", { href: urls[p], target: "_blank", rel: "noreferrer", className: "upl-name", children: p.split('/').pop()?.replace(/^\d+-/, '') }), !readOnly && _jsx("button", { type: "button", className: "link danger", onClick: () => remove(p), children: "\u2715" })] }, p));
                    }), !readOnly && (_jsxs("label", { className: "upl-add", children: [_jsx("input", { type: "file", multiple: true, accept: accept, onChange: (e) => { add(e.target.files); e.target.value = ''; } }), busy ? t.uploading(busy) : t.addFiles] }))] }), msg && _jsx("p", { className: "error small", children: msg })] }));
}
