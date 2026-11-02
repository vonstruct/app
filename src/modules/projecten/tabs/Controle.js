import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../../../core/supabase';
import { useQuery } from '../../../core/useQuery';
import { DataTable } from '../../../core/DataTable';
import { ErrorBox, Loading } from '../../../core/ui';
import { OwnArticleEditor } from '../../../core/OwnArticle';
import { ItemWhere } from '../../../core/ItemWhere';
/** Meldingen uit PaletteCAD. "Beslag zonder artikelnummer" los je hier op door het een eigen artikel te maken. */
export function Controle({ dvId }) {
    const q = useQuery(() => supabase.from('app_checks').select('*').eq('design_version_id', dvId).order('level'), [dvId]);
    const [msg, setMsg] = useState(null);
    if (q.loading && !q.data)
        return _jsx(Loading, {});
    const rows = q.data ?? [];
    const open = rows.filter((r) => !r.resolved);
    return (_jsxs(_Fragment, { children: [_jsx(ErrorBox, { error: q.error }), _jsxs("p", { className: "muted", children: [open.length === 0 ? 'Alle meldingen zijn opgelost.' : `${open.length} open melding${open.length === 1 ? '' : 'en'}.`, " Beslag zonder artikelnummer hoef je niet in PaletteCAD aan te vullen: kies hier de herkomst en de prijs, dan wordt het op naam herkend."] }), msg && _jsx("p", { className: "notice", children: msg }), _jsx(DataTable, { rows: rows, rowKey: (r) => r.id, filter: false, empty: "Geen meldingen", columns: [
                    { key: 'level', label: 'Niveau', render: (r) => r.resolved ? _jsx("span", { className: "badge ok", children: "opgelost" }) : _jsx("span", { className: r.level === 'fout' ? 'badge bad' : 'badge warn', children: r.level }) },
                    { key: 'part', label: 'Onderdeel', render: (r) => r.part ? _jsxs(_Fragment, { children: [r.part, " ", r.code === 'GEEN_ARTIKELNR' && _jsx(ItemWhere, { dvId: dvId, name: r.part })] }) : null },
                    { key: 'cabinet', label: 'Kast' },
                    { key: 'message', label: 'Melding', render: (r) => _jsx("span", { className: r.resolved ? 'muted' : undefined, children: r.message }) },
                    {
                        key: 'fix', label: 'Oplossen', render: (r) => r.resolved ? _jsx("span", { className: "ok-text", children: r.resolution })
                            : r.code === 'GEEN_ARTIKELNR' && r.part ? (_jsx(OwnArticleEditor, { articleNo: null, description: r.part, supplier: null, onSaved: (m) => { setMsg(m); q.reload(); } })) : r.code === 'LOSSE_PLAAT' ? _jsx("span", { className: "muted", children: "In PaletteCAD in een kast zetten, of laten zo (komt onder \"zonder kast\")" }) : null,
                    },
                ] })] }));
}
