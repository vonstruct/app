import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import logo from '../assets/vonstruct-logo.webp';
import { LangPicker, Portal } from '../portal/Portal';
import { storeLang, storedLang, tr } from '../portal/i18n';
/**
 * Login-poort. Na het inloggen bepaalt Supabase (functie my_role) de rol:
 * beheerder → de volledige app; klant, partner of onderaannemer → het portaal; anders geen toegang.
 */
export function AuthGate({ children }) {
    const [session, setSession] = useState(undefined);
    const [role, setRole] = useState(undefined);
    const [recovery, setRecovery] = useState(false);
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data } = supabase.auth.onAuthStateChange((e, s) => {
            if (e === 'PASSWORD_RECOVERY')
                setRecovery(true);
            setSession(s);
        });
        return () => data.subscription.unsubscribe();
    }, []);
    useEffect(() => {
        if (!session)
            return setRole(undefined);
        supabase.rpc('my_role').then(({ data }) => setRole(data ?? null));
    }, [session]);
    if (session === undefined)
        return _jsx("div", { className: "center muted", children: "Laden\u2026" });
    if (!session)
        return _jsx(Login, {});
    if (recovery)
        return _jsx(NewPassword, { onDone: () => setRecovery(false) });
    if (role === undefined)
        return _jsx("div", { className: "center muted", children: "Toegang controleren\u2026" });
    if (role === 'beheerder')
        return _jsx(_Fragment, { children: children });
    if (role)
        return _jsx(Portal, { role: role });
    const t = tr(storedLang());
    return (_jsxs("div", { className: "auth", children: [_jsx("aside", { className: "auth-hero", children: _jsxs("div", { className: "auth-hero-top", children: [_jsx("img", { className: "auth-logo", src: logo, alt: "Vonstruct" }), _jsx("span", { className: "auth-tagline", children: "Custom interiors" })] }) }), _jsx("main", { className: "auth-main", children: _jsxs("div", { className: "auth-form", children: [_jsxs("header", { children: [_jsx("h2", { children: t.noAccess }), _jsx("p", { className: "muted", children: t.noAccessText(session.user.email ?? '') })] }), _jsx("button", { className: "auth-alt", onClick: () => supabase.auth.signOut(), children: t.signOut })] }) })] }));
}
function Login() {
    const [lang, setLang] = useState(storedLang);
    const t = tr(lang);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Geen zelfregistratie: klanten, partners en medewerkers krijgen een uitnodiging per mail.
    const linkError = (() => { try {
        const h = sessionStorage.getItem('authLinkError');
        sessionStorage.removeItem('authLinkError');
        return h;
    }
    catch {
        return null;
    } })();
    const [mode, setMode] = useState(linkError ? 'link' : 'pw');
    const [msg, setMsg] = useState(linkError ? { error: true, text: tr(storedLang()).linkUsed } : null);
    const [busy, setBusy] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        if (mode === 'pw') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error)
                setMsg({ error: true, text: error.message === 'Invalid login credentials' ? t.wrongPw : error.message });
        }
        else {
            // via Edge Function send-login-link: mail in huisstijl, enkel naar gekende adressen
            const { error } = await supabase.functions.invoke('send-login-link', { body: { email, kind: 'magiclink', lang } });
            setMsg(error ? { error: true, text: t.linkFail } : { error: false, text: t.linkSent(email) });
        }
        setBusy(false);
    };
    const reset = async () => {
        if (!email)
            return setMsg({ error: true, text: t.emailFirst });
        const { error } = await supabase.functions.invoke('send-login-link', { body: { email, kind: 'recovery', lang } });
        setMsg(error ? { error: true, text: t.mailFail } : { error: false, text: t.resetSent(email) });
    };
    return (_jsxs("div", { className: "auth", children: [_jsxs("aside", { className: "auth-hero", children: [_jsx("svg", { className: "auth-lines", "aria-hidden": "true", viewBox: "20 120 510 600", preserveAspectRatio: "xMaxYMin meet", children: _jsxs("g", { fill: "none", stroke: "currentColor", strokeWidth: "1", children: [_jsx("rect", { x: "90", y: "140", width: "420", height: "520" }), _jsx("line", { x1: "90", y1: "270", x2: "510", y2: "270" }), _jsx("line", { x1: "90", y1: "400", x2: "510", y2: "400" }), _jsx("line", { x1: "90", y1: "530", x2: "510", y2: "530" }), _jsx("line", { x1: "300", y1: "140", x2: "300", y2: "270" }), _jsx("line", { x1: "300", y1: "530", x2: "300", y2: "660" }), _jsx("rect", { x: "110", y: "160", width: "170", height: "90" }), _jsx("rect", { x: "320", y: "160", width: "170", height: "90" }), _jsx("rect", { x: "110", y: "550", width: "170", height: "90" }), _jsx("rect", { x: "320", y: "550", width: "170", height: "90" }), _jsx("line", { x1: "40", y1: "140", x2: "40", y2: "660", strokeDasharray: "4 6" }), _jsx("line", { x1: "32", y1: "140", x2: "48", y2: "140" }), _jsx("line", { x1: "32", y1: "660", x2: "48", y2: "660" }), _jsx("line", { x1: "90", y1: "700", x2: "510", y2: "700", strokeDasharray: "4 6" }), _jsx("line", { x1: "90", y1: "692", x2: "90", y2: "708" }), _jsx("line", { x1: "510", y1: "692", x2: "510", y2: "708" })] }) }), _jsxs("div", { className: "auth-hero-top", children: [_jsx("img", { className: "auth-logo", src: logo, alt: "Vonstruct" }), _jsx("span", { className: "auth-tagline", children: "Custom interiors" })] }), _jsxs("div", { className: "auth-hero-text", "aria-hidden": "true", children: [_jsx("h1", { children: t.heroTitle }), _jsx("p", { children: t.heroText })] })] }), _jsxs("main", { className: "auth-main", children: [_jsx("div", { className: "auth-lang", children: _jsx(LangPicker, { lang: lang, label: t.language, onPick: (l) => { setLang(l); storeLang(l); setMsg(null); } }) }), _jsxs("form", { className: "auth-form", onSubmit: submit, children: [_jsxs("header", { children: [_jsx("h2", { children: t.welcome }), _jsx("p", { className: "muted", children: mode === 'pw' ? t.loginPw : t.loginLink })] }), _jsxs("label", { className: "auth-field", children: [_jsx("span", { children: t.email }), _jsx("input", { type: "email", autoComplete: "username", placeholder: t.emailPh, value: email, onChange: (e) => setEmail(e.target.value), required: true, autoFocus: true })] }), mode === 'pw' && (_jsxs("label", { className: "auth-field", children: [_jsxs("span", { className: "auth-field-head", children: [t.password, _jsx("button", { type: "button", className: "link", onClick: reset, children: t.forgot })] }), _jsxs("span", { className: "auth-pw", children: [_jsx("input", { type: showPw ? 'text' : 'password', autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), required: true }), _jsx("button", { type: "button", className: "auth-eye", onClick: () => setShowPw(!showPw), "aria-label": showPw ? t.hide : t.show, children: showPw ? t.hide : t.show })] })] })), msg && _jsx("p", { className: msg.error ? 'auth-msg error' : 'auth-msg', role: "status", children: msg.text }), _jsx("button", { type: "submit", className: "primary auth-submit", disabled: busy, children: busy ? _jsx("span", { className: "auth-spinner", "aria-label": "\u2026" }) : mode === 'pw' ? t.signIn : t.sendLink }), _jsx("div", { className: "auth-or", children: _jsx("span", { children: t.or }) }), _jsx("button", { type: "button", className: "auth-alt", onClick: () => { setMode(mode === 'pw' ? 'link' : 'pw'); setMsg(null); }, children: mode === 'pw' ? t.useLink : t.usePw }), _jsx("p", { className: "auth-switch muted", children: t.noAccessYet })] }), _jsxs("footer", { className: "auth-foot muted", children: ["\u00A9 ", new Date().getFullYear(), " Vonstruct"] })] })] }));
}
/** Na een link "nieuw wachtwoord": wachtwoord kiezen. */
function NewPassword({ onDone }) {
    const t = tr(storedLang());
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [msg, setMsg] = useState(null);
    const [busy, setBusy] = useState(false);
    const save = async (e) => {
        e.preventDefault();
        if (pw.length < 8)
            return setMsg(t.pwShort);
        if (pw !== pw2)
            return setMsg(t.pwDiff);
        setBusy(true);
        const { error } = await supabase.auth.updateUser({ password: pw });
        setBusy(false);
        if (error)
            return setMsg(error.message);
        onDone();
    };
    return (_jsxs("div", { className: "auth", children: [_jsx("aside", { className: "auth-hero", children: _jsxs("div", { className: "auth-hero-top", children: [_jsx("img", { className: "auth-logo", src: logo, alt: "Vonstruct" }), _jsx("span", { className: "auth-tagline", children: "Custom interiors" })] }) }), _jsx("main", { className: "auth-main", children: _jsxs("form", { className: "auth-form", onSubmit: save, children: [_jsxs("header", { children: [_jsx("h2", { children: t.newPw }), _jsx("p", { className: "muted", children: t.newPwIntro })] }), _jsxs("label", { className: "auth-field", children: [_jsx("span", { children: t.newPw }), _jsx("input", { type: "password", autoComplete: "new-password", value: pw, onChange: (e) => setPw(e.target.value), autoFocus: true })] }), _jsxs("label", { className: "auth-field", children: [_jsx("span", { children: t.repeat }), _jsx("input", { type: "password", autoComplete: "new-password", value: pw2, onChange: (e) => setPw2(e.target.value) })] }), msg && _jsx("p", { className: "auth-msg error", children: msg }), _jsx("button", { type: "submit", className: "primary auth-submit", disabled: busy, children: t.save })] }) })] }));
}
