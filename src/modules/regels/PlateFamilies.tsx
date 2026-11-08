import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { useQuery } from '../../core/useQuery'
import { ErrorBox, Loading } from '../../core/ui'
import { toast } from '../../core/toast'
import { fmtEur, fmtNum } from '../../core/format'

type Member = {
  supplier: string; sku: string; description: string | null; thickness_mm: number; length_mm: number; width_mm: number
  price: number | null; price_m2: number | null; protective_film: boolean; note: string | null
  added: boolean; excluded_id?: number | null; added_id?: number
}
type Family = {
  family: string; family_name: string; labels: string[]; aliases: { id: number; material: string }[]
  used_thickness: number[]; projects: string[]; n_parts: number; members: Member[]
}
type Hit = { supplier_name: string; supplier_sku: string; description: string; thickness_mm: number; length_mm: number; width_mm: number; purchase_price: number | null }

/**
 * Rekenregels → Plaatmaterialen (8/11/2026): welke platen uit de prijslijsten bij een materiaal horen (alle diktes en
 * formaten, bij elke leverancier). De app koppelt zelf op de naam (decorcode, afwerking, kwaliteit); hier nakijken:
 * een plaat niet gebruiken, een plaat toevoegen, of een materiaal zonder platen koppelen aan een materiaal uit de prijslijst.
 * Eén verzoek voor de hele lijst (plate_families_overview).
 */
export function PlateFamilies() {
  const q = useQuery<Family[]>(() => supabase.rpc('plate_families_overview'), [])
  const [busy, setBusy] = useState(false)
  const refresh = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('plate_catalog_refresh')
    setBusy(false)
    if (error) toast(error.message, 'err')
    else { toast(`Prijslijsten opnieuw gekoppeld: ${data} platen`); q.reload() }
  }
  return (
    <div className="pf">
      <h2>Plaatmaterialen</h2>
      <p className="muted">
        Per materiaal de platen die de optimizer mag gebruiken: alle diktes en formaten, bij elke leverancier. De app zoekt ze zelf in de prijslijsten op de naam
        (decorcode, afwerking, kwaliteit), elke nacht opnieuw. Kijk hier na of het klopt. Een wijziging geldt bij de volgende berekening (Herberekenen bij de versie).
        Hieronder de materialen uit de laatste versie van elk project.
      </p>
      <div className="toolbar">
        <button onClick={refresh} disabled={busy}>{busy ? 'Bezig…' : '↻ Prijslijsten opnieuw koppelen'}</button>
      </div>
      <ErrorBox error={q.error} />
      {q.loading ? <Loading /> : (q.data ?? []).length === 0 ? <p className="muted">Nog geen materialen in een project.</p> : (q.data ?? []).map((f) => <FamilyCard key={f.family} f={f} onChanged={q.reload} />)}
    </div>
  )
}

function FamilyCard({ f, onChanged }: { f: Family; onChanged: () => void }) {
  const [all, setAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const used = new Set((f.used_thickness ?? []).map(Number))
  const members = f.members.filter((m) => all || !used.size || used.has(Number(m.thickness_mm)))
  const active = f.members.filter((m) => !m.excluded_id)
  const perSup = Object.entries(active.reduce<Record<string, number>>((a, m) => ({ ...a, [m.supplier]: (a[m.supplier] ?? 0) + 1 }), {}))
  const none = active.length === 0

  const exclude = async (m: Member) => {
    const { error } = await supabase.from('plate_family_overrides').insert({ family: f.family, supplier: m.supplier, sku: m.sku, action: 'uitsluiten' })
    if (error) toast(error.message, 'err'); else { toast('Deze plaat wordt niet meer gebruikt voor dit materiaal'); onChanged() }
  }
  const undo = async (id: number, msg: string) => {
    const { error } = await supabase.from('plate_family_overrides').delete().eq('id', id)
    if (error) toast(error.message, 'err'); else { toast(msg); onChanged() }
  }
  const unalias = async (id: number) => {
    const { error } = await supabase.from('plate_family_alias').delete().eq('id', id)
    if (error) toast(error.message, 'err'); else { toast('Koppeling weg'); onChanged() }
  }

  return (
    <details className="pf-card card" open={none}>
      <summary>
        <b>{f.family_name}</b>
        <span className="muted">{[...used].sort((a, b) => a - b).map((t) => `${fmtNum(t)} mm`).join(' · ')}</span>
        {none ? <span className="chip bad">geen platen in de prijslijsten</span> : perSup.map(([s, n]) => <span key={s} className="chip">{s}: {n}</span>)}
        {!!f.projects?.length && <span className="muted small">in {f.projects.join(', ')}</span>}
      </summary>
      <div className="pf-body">
        {!!f.labels?.length && <p className="small muted">In PaletteCAD: {f.labels.join(' · ')}</p>}
        {!!f.aliases?.length && (
          <p className="small">
            Gekoppeld: {f.aliases.map((a) => (
              <span key={a.id} className="chip" style={{ marginRight: 6 }}>{a.material} <button className="link small" title="Koppeling weghalen" onClick={() => unalias(a.id)}>×</button></span>
            ))}
          </p>
        )}
        {none && (
          <>
            <p className="notice small">
              Geen platen gevonden. Koppel dit materiaal aan een materiaal uit de prijslijst, voeg een plaat toe, of geef een formaat met prijs in bij Plaatformaten hieronder.
            </p>
            {f.labels.length > 0 && <FamilySearch label={f.labels[0]} onDone={onChanged} />}
          </>
        )}
        {members.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th className="num">Dikte</th><th>Leverancier</th><th>Artikel</th><th>Omschrijving</th><th>Formaat</th><th className="num">Per plaat</th><th className="num">Per m²</th><th></th></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={`${m.supplier}|${m.sku}`} className={m.excluded_id ? 'pf-off' : ''}>
                    <td className="num">{fmtNum(m.thickness_mm)} mm</td>
                    <td>{m.supplier}</td>
                    <td>{m.sku}</td>
                    <td>{m.description}{m.protective_film ? ' (beschermfolie)' : ''}{m.note ? <span className="muted"> · {m.note}</span> : ''}</td>
                    <td>{Math.round(m.length_mm)}×{Math.round(m.width_mm)}</td>
                    <td className="num">{fmtEur(m.price)}</td>
                    <td className="num">{fmtEur(m.price_m2)}</td>
                    <td>
                      {m.added ? <button className="link small" onClick={() => m.added_id && undo(m.added_id, 'Weggehaald')}>weghalen</button>
                        : m.excluded_id ? <button className="link small" onClick={() => undo(m.excluded_id!, 'Wordt weer gebruikt')}>terug gebruiken</button>
                        : <button className="link small" onClick={() => exclude(m)}>niet gebruiken</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="toolbar">
          {used.size > 0 && f.members.length > members.length && <button className="link small" onClick={() => setAll(true)}>Alle diktes tonen ({f.members.length})</button>}
          {all && <button className="link small" onClick={() => setAll(false)}>Enkel de gebruikte diktes</button>}
          <button className="link small" onClick={() => setAdding(!adding)}>{adding ? 'Sluiten' : '+ Plaat toevoegen'}</button>
        </div>
        {adding && <PlateSearch family={f.family} onDone={() => { setAdding(false); onChanged() }} />}
      </div>
    </details>
  )
}

/** een plaat uit de prijslijsten toevoegen aan dit materiaal */
function PlateSearch({ family, onDone }: { family: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const search = async () => {
    const t = text.trim()
    if (t.length < 2) return
    const { data, error } = await supabase.from('supplier_catalog')
      .select('supplier_name, supplier_sku, description, thickness_mm, length_mm, width_mm, purchase_price')
      .eq('unit_name', 'Plaat').or(`description.ilike.%${t.replace(/[%,()]/g, ' ')}%` + (/^[A-Za-z0-9-]+$/.test(t) ? `,supplier_sku.eq.${t}` : ''))
      .not('purchase_price', 'is', null).order('description').limit(30)
    if (error) toast(error.message, 'err'); else setHits((data ?? []) as Hit[])
  }
  const add = async (h: Hit) => {
    const { error } = await supabase.from('plate_family_overrides').insert({ family, supplier: h.supplier_name, sku: String(h.supplier_sku).trim(), action: 'toevoegen' })
    if (error) toast(error.message, 'err'); else { toast('Plaat toegevoegd'); onDone() }
  }
  return (
    <div className="pf-search">
      <div className="toolbar">
        <input placeholder="Zoek in de prijslijsten (naam of artikelnummer)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button onClick={search}>Zoeken</button>
      </div>
      {hits && (hits.length === 0 ? <p className="muted small">Niets gevonden.</p> : (
        <ul className="pf-hits">
          {hits.map((h) => (
            <li key={`${h.supplier_name}|${h.supplier_sku}`}>
              <span>{h.supplier_name} · {h.supplier_sku} · {h.description} · {fmtNum(h.thickness_mm)} mm · {Math.round(Math.max(h.length_mm, h.width_mm))}×{Math.round(Math.min(h.length_mm, h.width_mm))} · {fmtEur(h.purchase_price)}</span>
              <button className="link small" onClick={() => add(h)}>+ toevoegen</button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}

/** een materiaal uit PaletteCAD koppelen aan een materiaal (familie) uit de prijslijsten */
function FamilySearch({ label, onDone }: { label: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const [hits, setHits] = useState<{ family: string; family_name: string; n: number }[] | null>(null)
  const search = async () => {
    const t = text.trim()
    if (t.length < 2) return
    const { data, error } = await supabase.from('plate_catalog').select('family, family_name').eq('active', true)
      .ilike('family_name', `%${t.replace(/[%,()]/g, ' ')}%`).order('family_name').limit(300)
    if (error) { toast(error.message, 'err'); return }
    const by = new Map<string, { family: string; family_name: string; n: number }>()
    for (const r of (data ?? []) as { family: string; family_name: string }[]) {
      const x = by.get(r.family) ?? { family: r.family, family_name: r.family_name, n: 0 }
      x.n += 1
      by.set(r.family, x)
    }
    setHits([...by.values()].slice(0, 25))
  }
  const link = async (family: string) => {
    const { error } = await supabase.from('plate_family_alias').insert({ material: label, family })
    if (error) toast(error.message, 'err'); else { toast(`"${label}" gekoppeld`); onDone() }
  }
  return (
    <div className="pf-search">
      <div className="toolbar">
        <input placeholder={`Koppel "${label}" aan… (bv. decorcode of naam)`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button onClick={search}>Zoeken</button>
      </div>
      {hits && (hits.length === 0 ? <p className="muted small">Niets gevonden.</p> : (
        <ul className="pf-hits">
          {hits.map((h) => (
            <li key={h.family}><span>{h.family_name} <span className="muted">({h.n} platen)</span></span><button className="link small" onClick={() => link(h.family)}>koppelen</button></li>
          ))}
        </ul>
      ))}
    </div>
  )
}
