// Schermtest (7 nov 2026): opent elke pagina van de app met verzonnen gegevens (alle verzoeken naar Supabase worden onderschept)
// en faalt bij een JavaScript-fout, een wit scherm of de melding van de foutopvang. Draait in de workflow vóór het publiceren.
// Lokaal: npm run build && npx vite preview --port 4173 & node tests/smoke.mjs
import { createRequire } from 'node:module'
import { tables, rpc, projectPage, events } from './fixtures.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://localhost:4173/'
const ROUTES = [
  '#/overzicht', '#/von', '#/von?tab=gedaan', '#/von?tab=team', '#/inbox', '#/agenda', '#/opdrachten', '#/capaciteit', '#/taken',
  '#/bestellingen', '#/bestellingen?tab=mailbox', '#/facturen', '#/facturen?tab=aankoop',
  '#/projecten', '#/projecten/209901', '#/projecten/209901?tab=ontwerp', '#/projecten/209901?tab=geld', '#/projecten/209901?tab=uitvoering',
  '#/projecten/209901?tab=dossier', '#/projecten/209902', '#/projecten/209901?tab=kost', '#/projecten/209901?tab=offerte', '#/projecten/209901?tab=facturen',
  '#/projecten/209901?tab=nacalculatie', '#/projecten/209903?tab=productie', '#/projecten/209903?tab=opdrachten', '#/projecten/209903?tab=oplevering',
  '#/projecten/209901?tab=vragenlijst', '#/projecten/209901?tab=brochure', '#/projecten/209901?tab=documenten', '#/projecten/209901?tab=tijdlijn',
  '#/projecten/209901/v/3', '#/projecten/209901/v/3?tab=platen', '#/projecten/209901/v/3?tab=kasten', '#/projecten/209901/v/3?tab=lades', '#/projecten/209901/v/3?tab=beslag', '#/projecten/209901/v/3?tab=controle',
  '#/cijfers', '#/relaties', '#/relaties?tab=klanten&view=tabel', '#/instellingen', '#/regels', '#/regels?sectie=Plaatoptimalisatie', '#/regels?sectie=Meldingen', '#/mails', '#/portaal',
]

const jwt = () => {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const payload = { sub: 'u1', email: 'beheer@voorbeeld.be', role: 'authenticated', aud: 'authenticated', exp, aal: 'aal2', amr: [{ method: 'password', timestamp: exp - 100 }] }
  return { exp, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.c2ln' }
}

function mock(role) {
  return async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', email: 'beheer@voorbeeld.be', aud: 'authenticated', role: 'authenticated', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] })
    if (p.startsWith('/auth/v1/')) return json({})
    if (p.startsWith('/functions/v1/agenda')) return json({ events, warnings: [] })
    if (p.startsWith('/functions/v1/')) return json({})
    if (p.startsWith('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>demo</body></html>' })
    if (p.startsWith('/rest/v1/rpc/')) {
      const name = p.split('/').pop()
      if (name === 'my_role') return json(role)
      if (name === 'project_page') { const b = JSON.parse(req.postData() || '{}'); return json(projectPage(b.p_code)) }
      return json(name in rpc ? rpc[name] : [])
    }
    if (p.startsWith('/rest/v1/')) {
      let rows = tables[p.replace('/rest/v1/', '')] ?? []
      for (const [k, v] of u.searchParams) { const m = /^eq\.(.*)$/.exec(v); if (m && rows.length && k in rows[0]) rows = rows.filter((r) => String(r[k]) === m[1]) }
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}`, 'access-control-allow-origin': '*' } })
      if (req.method() !== 'GET') return json(single ? rows[0] ?? {} : [], 201)
      if (single) return rows[0] ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406)
      return json(rows)
    }
    return json({})
  }
}

const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const fails = []
for (const [label, size, routes, role] of [['computer', { width: 1280, height: 800 }, ROUTES, 'beheerder'], ['gsm', { width: 390, height: 844 }, ['#/overzicht', '#/projecten/209901', '#/agenda', '#/bestellingen'], 'beheerder'], ['portaal klant', { width: 390, height: 844 }, [''], 'klant']]) {
  const ctx = await b.newContext({ viewport: size, locale: 'nl-BE', timezoneId: 'Europe/Brussels' })
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|ovogwibcneioclpzhyqf\.supabase\.co)/, (r) => r.abort())
  const { exp, token } = jwt()
  await ctx.addInitScript(([s]) => { try { localStorage.setItem('sb-ovogwibcneioclpzhyqf-auth-token', JSON.stringify(s)); localStorage.setItem('vonstruct.installLater', String(Date.now())) } catch {} },
    [{ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'demo', user: { id: 'u1', email: 'beheer@voorbeeld.be', aud: 'authenticated', role: 'authenticated' } }])
  await ctx.route('https://ovogwibcneioclpzhyqf.supabase.co/**', mock(role))
  for (const r of routes) {
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push('fout: ' + e.message.split('\n')[0]))
    await page.goto(BASE + r)
    await page.waitForTimeout(1500)
    const text = await page.evaluate(() => document.body.innerText)
    if (/kon niet getoond worden/.test(text)) errs.push('foutopvang: ' + (text.match(/(Deze pagina|Dit onderdeel) kon niet getoond worden[^\n]*\n[^\n]*\n([^\n]*)/)?.[2] ?? ''))
    if (text.trim().length < 40) errs.push('leeg scherm')
    if (errs.length) fails.push(`${label} ${r || '/'}: ${errs.join(' | ')}`)
    process.stdout.write(errs.length ? 'x' : '.')
    await page.close()
  }
  await ctx.close()
}
await b.close()
console.log(`\n${fails.length ? fails.length + ' pagina(s) met fouten' : 'Alle pagina\'s in orde'}`)
for (const f of fails) console.log(' - ' + f)
process.exit(fails.length ? 1 : 0)
