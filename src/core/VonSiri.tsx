import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Siri-koppeling voor VON: sleutel aanmaken/intrekken en stappenplan voor de Opdrachten-app op de iPhone. */
type Key = { id: string; name: string; created_at: string; last_used: string | null; uses: number; revoked_at: string | null }

const Steps = ({ endpoint, token }: { endpoint: string; token: string }) => (
  <div className="siri-steps">
    <h4>1. "Vraag VON" (vraag stellen)</h4>
    <ol>
      <li>Open de app <b>Opdrachten</b> op je iPhone → <b>+</b> (rechtsboven).</li>
      <li>Tik op de naam bovenaan en noem de opdracht <b>Vraag VON</b>.</li>
      <li>Voeg de actie <b>Dicteer tekst</b> toe (taal: Nederlands (België), stop met luisteren: na pauze).</li>
      <li>Voeg de actie <b>Haal inhoud op van URL</b> toe. URL: <Copy text={endpoint} />. Tik op de pijl ›:
        <ul>
          <li>Methode: <b>POST</b></li>
          <li>Headers → Nieuwe header: sleutel <code>x-von-key</code>, waarde: <Copy text={token} label="de sleutel" /></li>
          <li>Hoofdtekst verzoek: <b>JSON</b> → Nieuw veld (tekst) <code>mode</code> = <code>vraag</code>, Nieuw veld (tekst) <code>question</code> = <b>Gedicteerde tekst</b></li>
        </ul>
      </li>
      <li>Voeg de actie <b>Spreek tekst</b> toe met <b>Inhoud van URL</b>.</li>
      <li>Klaar: zeg <b>"Hey Siri, vraag VON"</b>.</li>
    </ol>
    <h4>2. Snelkoppelingen (zonder vraag)</h4>
    <p className="small">Zelfde als hierboven, maar <b>zonder</b> "Dicteer tekst" en met enkel het veld <code>mode</code>:</p>
    <ul className="small">
      <li>Naam <b>Mijn briefing</b> → <code>mode</code> = <code>briefing</code> ("Hey Siri, mijn briefing")</li>
      <li>Naam <b>Wat moet ik doen</b> → <code>mode</code> = <code>todo</code></li>
      <li>Naam <b>Mijn dag</b> → <code>mode</code> = <code>dag</code></li>
    </ul>
    <p className="small muted">Tip: maak eerst "Vraag VON", houd ze ingedrukt → <b>Dupliceer</b> en pas naam en velden aan.</p>
  </div>
)

function Copy({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <span className="copy">
      <code>{label ? '•••• ' + text.slice(-4) : text}</code>
      <button className="link small" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) } catch { /* geen klembord */ } }}>{ok ? '✓ gekopieerd' : 'kopieer'}</button>
    </span>
  )
}

export function VonSiri() {
  const [keys, setKeys] = useState<Key[] | null>(null)
  const [fresh, setFresh] = useState<{ token: string; endpoint: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = async () => {
    const { data } = await supabase.functions.invoke('von-keys', { body: { action: 'list' } })
    setKeys(((data as { keys?: Key[] } | null)?.keys ?? []).filter((k) => !k.name.startsWith('test')))
  }
  useEffect(() => { load() }, [])
  const create = async () => {
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('von-keys', { body: { action: 'create', name: 'iPhone' } })
    const d = data as { token?: string; endpoint?: string; error?: string } | null
    if (error || !d?.token) { setMsg(d?.error ?? 'Aanmaken mislukt.'); return }
    setFresh({ token: d.token, endpoint: d.endpoint! })
    load()
  }
  const revoke = async (id: string) => {
    if (!confirm('Deze sleutel intrekken? Siri-opdrachten met deze sleutel werken dan niet meer.')) return
    await supabase.functions.invoke('von-keys', { body: { action: 'revoke', id } })
    load()
  }
  const active = (keys ?? []).filter((k) => !k.revoked_at)
  return (
    <div className="von-siri">
      <p><b>VON via Siri</b>: zeg "Hey Siri, vraag VON", stel je vraag, Siri leest het antwoord voor. Ook met vergrendeld scherm, AirPods en in de auto. Via Siri kan VON enkel lezen en antwoorden.</p>
      {fresh ? (
        <>
          <p className="notice small">Je sleutel is aangemaakt. Kopieer hem nu in de Opdrachten-app: hij wordt <b>maar één keer</b> getoond. Deel hem met niemand.</p>
          <Steps endpoint={fresh.endpoint} token={fresh.token} />
          <button onClick={() => setFresh(null)}>Klaar</button>
        </>
      ) : (
        <>
          {keys === null ? <p className="muted small">Laden…</p> : active.length > 0 ? (
            <ul className="mini">
              {active.map((k) => (
                <li key={k.id}>
                  <span>{k.name}</span>
                  <span className="muted small"> sinds {new Date(k.created_at).toLocaleDateString('nl-BE')} · {k.uses}× gebruikt{k.last_used ? `, laatst ${new Date(k.last_used).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                  <button className="link small" onClick={() => revoke(k.id)}>intrekken</button>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Nog geen Siri-sleutel.</p>}
          <button className="primary" onClick={create}>{active.length ? 'Nieuwe sleutel maken' : 'Sleutel maken en stappen tonen'}</button>
          {msg && <p className="bad-text small">{msg}</p>}
        </>
      )}
    </div>
  )
}
