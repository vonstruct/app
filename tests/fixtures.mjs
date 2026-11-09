// Verzonnen testgegevens voor de schermtest (tests/smoke.mjs). Geen echte klanten, partners of projecten: enkel voorbeeldnamen en codes 2099xx.
const now = Date.now()
const iso = (days, h = 9, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + days); x.setHours(h, m, 0, 0); return x.toISOString() }
const day = (days) => iso(days).slice(0, 10)

const projects = [
  { project_id: 'p1', project_code: '209901', title: 'Keuken en berging', phase: 'design', phase_label: 'Ontwerp', phase_sort: 2, phase_active: true, target_install_week: '2099-W10', site_street: 'Dorpsstraat 1', site_postal_code: '1000', site_city: 'Brussel', client_id: 'c1', client_number: 101, client_name: 'Jan Peeters', client_email: 'jan@voorbeeld.be', client_phone: '0470 00 00 01', n_versions: 3, last_version: 3, last_received: iso(-1), scene_title: 'Keuken v3', n_cabinets: 14, n_parts: 312, n_errors: 1, n_warnings: 3, optimizer_status: 'klaar', cost_status: 'klaar', optimizer_ok: true, cost_ok: true, cost_total: 1234.5, n_missing_prices: 4, last_activity: iso(-1), days_idle: 1, stage: 'design', stage_label: 'Ontwerp', stage_sort: 2, stage_gate: 'Ontwerp goedgekeurd', intro_at: null, lead_source: null, survey_status: 'submitted' },
  { project_id: 'p2', project_code: '209902', title: 'Dressing', phase: 'lead', phase_label: 'Aanvraag', phase_sort: 1, phase_active: true, target_install_week: null, site_street: null, site_postal_code: null, site_city: 'Gent', client_id: 'c2', client_number: 102, client_name: 'An Janssens', client_email: 'an@voorbeeld.be', client_phone: '0470 00 00 02', n_versions: 0, last_version: null, last_received: null, scene_title: null, n_cabinets: null, n_parts: null, n_errors: null, n_warnings: null, optimizer_status: null, cost_status: null, optimizer_ok: null, cost_ok: null, cost_total: null, n_missing_prices: 0, last_activity: iso(-2), days_idle: 2, stage: 'lead', stage_label: 'Aanvraag', stage_sort: 1, stage_gate: 'Kennismaking gehad', intro_at: iso(1, 11), lead_source: 'Bookings', survey_status: 'open' },
  { project_id: 'p3', project_code: '209903', title: 'Badkamermeubel', phase: 'production', phase_label: 'Productie', phase_sort: 5, phase_active: true, target_install_week: '2099-W12', install_start: day(20), install_end: day(22), site_street: 'Kerkplein 5', site_postal_code: '2000', site_city: 'Antwerpen', client_id: 'c3', client_number: 103, client_name: 'Tom Claes', client_email: null, client_phone: '0470 00 00 03', n_versions: 2, last_version: 2, last_received: iso(-9), scene_title: 'Bad v2', n_cabinets: 4, n_parts: 80, n_errors: 0, n_warnings: 0, optimizer_status: 'klaar', cost_status: 'klaar', optimizer_ok: true, cost_ok: true, cost_total: 987.65, n_missing_prices: 0, last_activity: iso(-5), days_idle: 5, stage: 'production', stage_label: 'Productie', stage_sort: 5, stage_gate: 'Klaar voor plaatsing', intro_at: null, lead_source: null, survey_status: 'submitted' },
  { project_id: 'p4', project_code: '209904', title: 'Bureau', phase: 'closed', phase_label: 'Afgerond', phase_sort: 7, phase_active: false, target_install_week: null, site_city: 'Leuven', client_id: 'c4', client_number: 104, client_name: 'Sara Maes', client_email: 'sara@voorbeeld.be', client_phone: null, n_versions: 1, last_version: 1, last_received: iso(-60), n_cabinets: 2, n_parts: 20, n_errors: 0, n_warnings: 0, optimizer_status: 'klaar', cost_status: 'klaar', optimizer_ok: true, cost_ok: true, cost_total: 111.11, n_missing_prices: 0, last_activity: iso(-40), stage: 'closed', stage_label: 'Afgerond', survey_status: null },
]
const phases = [
  { phase: 'lead', sort: 1, label: 'Aanvraag', active: true, idle_days: 3, stage: 'lead', selectable: true, gate: 'Kennismaking gehad' },
  { phase: 'design', sort: 2, label: 'Ontwerp', active: true, idle_days: 7, stage: 'design', selectable: true, gate: 'Ontwerp goedgekeurd' },
  { phase: 'quote', sort: 3, label: 'Offerte', active: true, idle_days: 7, stage: 'quote', selectable: true, gate: 'Offerte getekend' },
  { phase: 'signed', sort: 4, label: 'Voorbereiding', active: true, idle_days: 7, stage: 'signed', selectable: true, gate: 'Klaar voor productie' },
  { phase: 'production', sort: 5, label: 'Productie', active: true, idle_days: 7, stage: 'production', selectable: true, gate: 'Klaar voor plaatsing' },
  { phase: 'installation', sort: 6, label: 'Plaatsing', active: true, idle_days: 7, stage: 'installation', selectable: true, gate: 'Opgeleverd' },
  { phase: 'closed', sort: 7, label: 'Afgerond', active: false, idle_days: null, stage: 'closed', selectable: true, gate: null },
]
const cats = [
  { key: 'bestellingen', label: 'Bestellingen & leveringen', hint: null, sort: 1 },
  { key: 'planning', label: 'Planning & opdrachten', hint: null, sort: 2 },
  { key: 'klanten', label: 'Klanten & mails', hint: null, sort: 3 },
  { key: 'facturen', label: 'Facturen & betalingen', hint: null, sort: 4 },
  { key: 'kwaliteit', label: 'Kwaliteit', hint: null, sort: 5 },
  { key: 'systeem', label: 'Systemen', hint: null, sort: 9 },
]
const f = (o) => ({ prio: 2, kind: 'x', project_code: null, last_version: null, ref: null, title: '', detail: null, since: iso(-1), category: 'kwaliteit', kind_label: '', due_date: null, due_reason: null, context: null, reason: null, agent: null, proposal_kind: null, proposal_title: null, proposal_summary: null, plan: null, link: null, client_name: null, ...o })
const today = [
  f({ prio: 1, kind: 'aanvraag_nieuw', project_code: '209902', title: 'Nieuwe aanvraag: An Janssens', detail: 'Kennismaking morgen 11:00 · via Bookings', category: 'klanten', client_name: 'An Janssens', due_date: day(1), due_reason: 'kennismaking' }),
  f({ prio: 1, kind: 'von_voorstel', project_code: '209901', ref: 'vp1', title: 'VON stelt voor: Antwoord aan Jan Peeters', category: 'klanten', agent: 'inbox', proposal_title: 'Antwoord op de vraag over de levering', context: 'Jan vroeg per mail wanneer de keuken geleverd wordt.', reason: 'De klant wacht al 3 dagen op antwoord.', client_name: 'Jan Peeters', due_date: day(0) }),
  f({ prio: 1, kind: 'bestelling', project_code: '209903', ref: 'o1', title: 'Bestellen bij Voorbeeldhout', detail: 'bestellen vóór 06/11/2099 · nodig op 13/11/2099 (plaatsing)', category: 'bestellingen', client_name: 'Tom Claes', due_date: day(-1) }),
  f({ prio: 1, kind: 'bestelling', project_code: '209901', ref: 'o2', title: 'Komt te laat: Tegelhuis Voorbeeld', detail: 'verwacht 14/11/2099 (uit mail) · nodig op 13/11/2099 (plaatsing)', category: 'bestellingen', client_name: 'Jan Peeters' }),
  f({ prio: 2, kind: 'bestelling', project_code: '209901', ref: 'o3', title: 'Geleverd? Beslag Voorbeeld', detail: 'verwacht 29/10/2099 (uit mail) · nog niet aangeduid als geleverd', category: 'bestellingen', client_name: 'Jan Peeters' }),
  f({ prio: 2, kind: 'bestelling', project_code: '209901', ref: 'o5', title: 'Ophalen bij Houthandel Voorbeeld', detail: 'klaar 06/11/2099 (uit mail) · nodig op 10/11/2099 (plaatsing)', category: 'bestellingen', client_name: 'Jan Peeters' }),
  f({ prio: 1, kind: 'levertijd', project_code: '209903', ref: 'o4', title: 'Levertijd onbekend: Plaathandel Voorbeeld', detail: 'nodig op 13/11/2099 (plaatsing) · vul de levertijd in of bestel', category: 'bestellingen', client_name: 'Tom Claes' }),
  f({ prio: 1, kind: 'taak', project_code: '209903', ref: 't9', title: 'Vandaag nog bestellen voor Tom (plaatsing 13/11): platen bij Plaathandel Voorbeeld en kanten bij Kantenhuis Voorbeeld, samen 2 bestellingen', category: 'bestellingen', client_name: 'Tom Claes', due_date: day(-2) }),
  f({ prio: 2, kind: 'prijzen', project_code: '209901', last_version: 3, title: '4 artikels zonder prijs', detail: 'De raming is onvolledig tot de prijs is ingevuld', category: 'kwaliteit' }),
  f({ prio: 2, kind: 'mail_antwoord', project_code: '209901', ref: 'm1', title: 'Wacht op antwoord: vraag over grepen', detail: 'Jan Peeters · 3 dagen', category: 'klanten' }),
  f({ prio: 2, kind: 'factuur', project_code: '209903', title: 'Voorschot te factureren', detail: '30 % van de offerte', category: 'facturen' }),
  f({ prio: 2, kind: 'datums', project_code: '209901', title: 'Datum ontbreekt: plaatsing of deadline', category: 'planning' }),
  f({ prio: 3, kind: 'stuklijst_opm', project_code: '209901', last_version: 3, title: '3 opmerkingen in de stuklijst', detail: 'Even nakijken of het klopt', category: 'kwaliteit' }),
  f({ prio: 2, kind: 'backup', title: 'Back-up ouder dan 36 uur', category: 'systeem' }),
]
const proposals = [
  { id: 'vp1', kind: 'mail_reply', status: 'voorstel', title: 'Antwoord op de vraag over de levering', project_code: '209901', created_at: iso(0, 7), source: 'mail', agent: 'inbox', context: 'Jan vroeg per mail wanneer de keuken geleverd wordt.', reason: 'De klant wacht al 3 dagen op antwoord.', due_date: day(0), due_reason: null, summary: 'Kort antwoord met de geplande week.', review: { ok: true, issues: [], warnings: [] }, plan: null, payload: { to: 'jan@voorbeeld.be', to_name: 'Jan Peeters', subject: 'Levering keuken', mailbox: 'info@', body: 'Dag Jan,\n\nDe keuken staat gepland in week 10. We bevestigen de exacte dag volgende week.\n\nGroeten' } },
  { id: 'vp2', kind: 'project_update', status: 'voorstel', title: 'Werfadres invullen', project_code: '209903', created_at: iso(-1, 15), source: 'planning', agent: 'planning', context: 'Het werfadres stond in de mail van de klant.', reason: 'Nodig voor de opdracht van de plaatser.', review: { ok: true, issues: [], warnings: ['Adres niet gecontroleerd'] }, plan: null, payload: { changes: { site_street: 'Kerkplein 5', site_city: 'Antwerpen' } }, before: { site_street: null, site_city: null } },
]
const doneProposals = [
  { id: 'vp3', kind: 'job_reminder', status: 'uitgevoerd', title: 'Herinnering aan de plaatser', project_code: '209903', created_at: iso(-2), decided_at: iso(-2, 10), decided_by: 'Olivier', result: 'verstuurd', payload: { note: '' } },
]
const clients = [
  { id: 'c1', client_number: 101, first_name: 'Jan', last_name: 'Peeters', company: null, email: 'jan@voorbeeld.be', phone: '0470 00 00 01', street: 'Dorpsstraat 1', postal_code: '1000', city: 'Brussel', language: 'nl' },
  { id: 'c2', client_number: 102, first_name: 'An', last_name: 'Janssens', company: null, email: 'an@voorbeeld.be', phone: '0470 00 00 02', street: null, postal_code: null, city: 'Gent', language: 'nl' },
  { id: 'c3', client_number: 103, first_name: 'Tom', last_name: 'Claes', company: 'Claes BV', email: null, phone: '0470 00 00 03', street: 'Kerkplein 5', postal_code: '2000', city: 'Antwerpen', language: 'en' },
  { id: 'c4', client_number: 104, first_name: 'Sara', last_name: 'Maes', company: null, email: 'sara@voorbeeld.be', phone: null, city: 'Leuven', language: 'nl' },
]
const partners = [{ id: 'pa1', name: 'Zaagatelier Voorbeeld', services: 'zagen en frezen', contact_person: 'Piet Voorbeeld', email: 'piet@voorbeeld.be', phone: '0470 00 00 10', city: 'Mechelen', active: true }]
const subcontractors = [
  { id: 's1', name: 'Elektro Voorbeeld', trade: 'electrician', contact_person: 'Karel', email: 'karel@voorbeeld.be', phone: '0470 00 00 20', city: 'Lier', active: true },
  { id: 's2', name: 'Plaatsers Voorbeeld', trade: 'contractor', contact_person: 'Lien', email: null, phone: '0470 00 00 21', city: 'Aalst', active: true },
]
const jobs = [
  { id: 'j1', title: 'Stopcontacten eiland', status: 'gepland', start_at: iso(2, 8), end_at: iso(2, 12), slot: 'voormiddag', job_type: 'Renovatie', address: 'Dorpsstraat 1, 1000 Brussel', project_code: '209901', show_client: true, notify_client: true, for_me: false, subcontractor_id: 's1', subcontractors: { name: 'Elektro Voorbeeld', trade: 'electrician' }, partners: null, instructions: 'Vier stopcontacten in het eiland.' },
  { id: 'j2', title: 'Keuken plaatsen', status: 'bevestigd', start_at: iso(9, 8), end_at: iso(10, 16), slot: 'dag', job_type: 'Nieuwbouw', address: 'Kerkplein 5, 2000 Antwerpen', project_code: '209903', show_client: true, for_me: true, confirmed_at: iso(-1), subcontractors: null, partners: null },
  { id: 'j3', title: 'Platen zagen', status: 'gepland', start_at: iso(0, 8), end_at: iso(0, 16), slot: 'dag', job_type: 'Productie', project_code: '209903', show_client: false, for_me: false, partner_id: 'pa1', subcontractors: null, partners: { name: 'Zaagatelier Voorbeeld' } },
]
const events = [
  { id: 'o:1', source: 'outlook', title: '209901 · Opmeting', start: iso(0, 14), end: iso(0, 15), all_day: false, location: 'Dorpsstraat 1, 1000 Brussel', project_code: '209901', organizer_is_me: true },
  { id: 'b:1', source: 'bookings', title: 'Kennismaking: An Janssens', start: iso(1, 11), end: iso(1, 12), all_day: false, customer: { name: 'An Janssens', email: 'an@voorbeeld.be', phone: '0470 00 00 02' } },
  { id: 'o:2', source: 'outlook', title: 'Overleg leverancier', start: iso(3, 10), end: iso(3, 11), all_day: false, location: 'Teams', online_url: 'https://example.com/teams' },
]
const tasks = [
  { id: 't1', text: 'Klant bellen over de kleur van de fronten', project_code: '209901', due_date: day(0), done_at: null, source: 'app', created_at: iso(-1), kind: 'buiten' },
  { id: 't2', text: 'Stalen ophalen bij de leverancier', project_code: null, due_date: day(3), done_at: null, source: 'app', created_at: iso(-2), kind: 'buiten' },
]
const mails = [
  { id: 'm1', mailbox: 'info@', direction: 'in', at: iso(-3, 9), from_name: 'Jan Peeters', from_email: 'jan@voorbeeld.be', to_emails: ['info@voorbeeld.be'], to_names: [], subject: 'Vraag over grepen', snippet: 'Kunnen we de grepen nog wijzigen?', summary: 'Jan wil weten of de grepen nog kunnen wijzigen.', category: 'klantvraag', needs_reply: true, urgency: 2, replied: false, dismissed_at: null, party_kind: 'klant', party_name: 'Jan Peeters', project_code: '209901', has_attachments: false, web_link: null, is_bulk: false, proposal_status: null },
  { id: 'm2', mailbox: 'info@', direction: 'in', at: iso(-1, 16), from_name: 'Voorbeeldhout', from_email: 'verkoop@voorbeeld.be', to_emails: ['info@voorbeeld.be'], to_names: [], subject: 'Orderbevestiging 4711', snippet: 'Bedankt voor uw bestelling', summary: 'Orderbevestiging, levering volgende week.', category: 'bestelling', needs_reply: false, urgency: 3, replied: false, dismissed_at: null, party_kind: 'leverancier', party_name: 'Voorbeeldhout', project_code: '209903', has_attachments: true, web_link: null, is_bulk: false, proposal_status: null },
  { id: 'm3', mailbox: 'info@', direction: 'out', at: iso(-1, 17), from_name: 'Info', from_email: 'info@voorbeeld.be', to_emails: ['an@voorbeeld.be'], to_names: ['An Janssens'], subject: 'Welkom', snippet: 'Welkom bij ons', summary: null, category: null, needs_reply: false, urgency: null, replied: false, dismissed_at: null, party_kind: 'klant', party_name: 'An Janssens', project_code: '209902', has_attachments: false, web_link: null, is_bulk: false, proposal_status: null },
]
const orders = [
  { id: 'o1', project_code: '209903', supplier: 'Voorbeeldhout', ordered_by: 'Vonstruct', categories: ['Platen'], status: 'te bestellen', needed_by: day(6), needed_by_manual: false, lead_days: 5, lead_days_eff: 5, order_by: day(-1), ordered_at: null, expected_at: null, delivered_at: null, reference: null, amount: 321.0, n_lines: 12, note: null, urgency: 'te laat besteld', client_name: 'Tom Claes', project_title: 'Badkamermeubel', n_docs: 1, needed_src: 'plaatsing', lead_src: 'ingevuld' },
  { id: 'o2', project_code: '209901', supplier: 'Beslag Voorbeeld', ordered_by: 'Vonstruct', categories: ['Beslag'], status: 'besteld', needed_by: day(20), needed_by_manual: false, lead_days: null, lead_days_eff: 0, order_by: null, ordered_at: day(-3), expected_at: day(4), delivered_at: null, reference: 'B-123', amount: 45.5, n_lines: 4, note: null, urgency: 'levertijd onbekend', client_name: 'Jan Peeters', project_title: 'Keuken en berging', n_docs: 0 },
]
// Vandaag v5.2: verzonnen bestellingen voor de rubrieken (te bestellen, leveringen)
Object.assign(orders[0], { urgency: 'te laat', client_name: 'Tom Claes', needed_src: 'plaatsing', items_text: '6 × Wit melamine 18 mm 2800x2070 · 4 × Eiken fineer MDF 19 mm · 2 × Wit melamine 8 mm' })
Object.assign(orders[1], { items_text: '40 × Scharnier 110° · 20 × Ladegeleider 500 mm · 8 × Greep 160 mm · 16 × Sokkelvoet', supplier: 'Tegelhuis Voorbeeld', urgency: 'komt te laat', client_name: 'Jan Peeters', expected_at: day(8), expected_src: 'uit mail', needed_by: day(7), needed_src: 'plaatsing' })
orders.push(
  { ...orders[1], id: 'o3', supplier: 'Beslag Voorbeeld', status: 'bevestigd', urgency: 'levering te laat', expected_at: day(-9), expected_src: 'uit mail', needed_by: null, needed_src: null },
  { ...orders[0], id: 'o4', supplier: 'Plaathandel Voorbeeld', urgency: 'nu bestellen', order_by: day(-2), order_by_last: day(3), ok_until: day(11), needed_by: day(6), needed_src: 'plaatsing', categories: ['Verbinders & Beslagen'], n_lines: 1, amount: 18.58, items_text: '14 × Clamex P-14', note: 'Aanvulling: kwam bij nadat de bestelling geplaatst was' },
  // hoe het binnenkomt (7 nov 2026): ik haal op, klant haalt op
  { ...orders[1], id: 'o5', supplier: 'Houthandel Voorbeeld', status: 'bevestigd', delivery: 'ophalen', urgency: 'op te halen', expected_at: day(-1), expected_src: 'uit mail', needed_by: day(3), needed_src: 'plaatsing' },
  { ...orders[1], id: 'o8', supplier: 'Tegels Voorbeeld', status: 'bevestigd', delivery: 'levering', urgency: 'tijdens plaatsing', expected_at: day(8), expected_src: 'uit mail', needed_by: day(6), needed_src: 'plaatsing', ok_until: day(11), categories: ['Tegels'], n_lines: 0, items_text: null, note: 'Uit mail: Orderbevestiging · Wandtegels wit 30x60' },
  // via de partner (bestelt, zaagt, freest, kant af): hoort bij Productie bij partner, niet bij de gewone bestellingen
  { ...orders[1], id: 'o9', project_code: '209903', client_name: 'Tom Claes', supplier: 'Plaathandel Voorbeeld', ordered_by: 'Zaagatelier Voorbeeld', via_partner: true, status: 'bevestigd', delivery: 'ophalen', urgency: 'via partner', expected_at: day(4), needed_by: day(6), needed_src: 'plaatsing', categories: ['Platen'], n_lines: 3, amount: 1024, items_text: '6 × Wit melamine 18 mm · 4 × Eiken fineer MDF 19 mm · 2 × Wit melamine 8 mm' },
  { ...orders[1], id: 'o10', project_code: '209903', client_name: 'Tom Claes', supplier: 'Kantenhuis Voorbeeld', ordered_by: 'Zaagatelier Voorbeeld', via_partner: true, status: 'geleverd', delivery: 'levering', urgency: 'klaar', expected_at: null, delivered_at: day(-1), needed_by: day(6), categories: ['Kanten'], n_lines: 2, amount: 129.32, items_text: '164 m Eiken kant 23 mm · 46 m Wit kant 23 mm' },
  { ...orders[1], id: 'o6', supplier: 'Toestellen Voorbeeld', status: 'besteld', delivery: 'klant', urgency: 'wordt opgehaald', expected_at: day(5), expected_src: null, needed_by: day(9), needed_src: 'plaatsing', categories: ['Toestellen'], n_lines: 0, note: 'Oven en kookplaat' },
  { ...orders[1], id: 'o7', supplier: 'Groothandel Voorbeeld', status: 'besteld', delivery: 'onderaannemer', pickup_by: 'Elektro Voorbeeld', urgency: 'wordt opgehaald', expected_at: null, expected_src: null, needed_by: day(9), needed_src: 'plaatsing', categories: ['Elektro'], n_lines: 3 },
)
const invoices = [
  { id: 'i1', project_code: '209903', quote_id: 'q1', seq: 1, kind: 'voorschot', label: 'Voorschot 30 %', pct: 30, amount_excl: 300, amount_vat: 18, amount_incl: 318, vat_split: null, status: 'te factureren', state: 'open', ready_at: day(-1), invoice_number: null, invoice_date: null, due_date: null, paid_amount: null, paid_at: null, note: null, client_name: 'Tom Claes', quote_number: 'OFF-0001', days_overdue: null },
]
const rules = [
  { key: 'besteld_door', section: 'Bestellen', sort: 1, sentence: 'Platen worden standaard besteld door {wie}.', explanation: 'Wie de platen bestelt als er niets anders gekozen is.', fields: { wie: { type: 'select', options: ['Partner', 'Vonstruct'] } }, value: { wie: 'Partner' }, updated_at: iso(-3), confirmed_at: iso(-3) },
  { key: 'kant_marge', section: 'Kanten', sort: 2, sentence: 'Tel {marge} mm extra kantenband per kant.', explanation: 'Voor het afkorten.', fields: { marge: { type: 'number', unit: 'mm' } }, value: { marge: 30 }, updated_at: iso(-3), confirmed_at: null },
  { key: 'nesting', section: 'Productiekosten', sort: 3, sentence: 'Nesting kost {prijs} per plaat.', explanation: null, fields: { prijs: { type: 'money' } }, value: { prijs: 1 }, updated_at: iso(-3), confirmed_at: iso(-3) },
]
const agents = [
  { id: 'von', name: 'VON', role: 'aanspreekpunt', model: 'claude-sonnet-5-5', enabled: true, max_runs_per_day: 40, daily_budget_usd: 2, sort: 1, tools: ['projects'], cost_today: 0.1, runs_today: 3, cost_30d: 4.2, runs_30d: 90 },
  { id: 'inbox', name: 'Inbox', role: 'mails lezen', model: 'claude-haiku-5-5', enabled: true, max_runs_per_day: 100, daily_budget_usd: 1, sort: 2, tools: ['inbox'], cost_today: 0.02, runs_today: 10, cost_30d: 1.1, runs_30d: 300 },
]
const activity = [
  { agent: 'inkoop', agent_name: 'Inkoop', source: 'mail_doc', ref: 'd1', at: iso(-1), project_code: '209903', title: 'Gekoppeld aan 209903', detail: 'Orderbevestiging Voorbeeldhout', link: '/bestellingen?tab=mailbox', can_undo: false, what: 'doc_link', verdict: null, review_note: null },
  { agent: 'planning', agent_name: 'Planning', source: 'task', ref: 't9', at: iso(-2), project_code: '209901', title: 'Taak gemaakt: klant bellen', detail: null, link: null, can_undo: false, what: 'task', verdict: 'ok', review_note: null },
]
const capacity = Array.from({ length: 8 }, (_, i) => ({ week_start: day(i * 7), iso_week: '2099-W' + (10 + i), my_job_days: i % 3, sub_job_days: 1, installs: i === 2 ? 1 : 0, install_projects: i === 2 ? [{ code: '209903', title: 'Badkamermeubel' }] : [], jobs: i % 2 ? [{ title: 'Keuken plaatsen', code: '209903', days: 2, me: true }] : [], planned_days: (i % 4) + 1, capacity_days: 4 }))

const projectPage = (code) => {
  const p = projects.find((x) => x.project_code === code) ?? projects[0]
  return {
    project: p,
    versions: p.last_version ? Array.from({ length: p.last_version }, (_, i) => ({ id: 'dv' + (p.last_version - i), version: p.last_version - i, received_at: iso(-1 - i * 3), exported_at: iso(-1 - i * 3), scene_title: p.scene_title, n_cabinets: p.n_cabinets, n_parts: p.n_parts, n_errors: i ? 0 : p.n_errors, n_warnings: p.n_warnings })) : [],
    timeline: { project_code: code, deadline: null, deadline_reason: null, works_start: null, install_start: p.install_start ?? null, install_days: 3, install_end: p.install_end ?? null, first_job: null, production_by: null, final_measure_by: null, final_measure_done: false, order_by: day(-1), order_by_supplier: 'Voorbeeldhout', target_install_week: p.target_install_week },
    gates: phases.slice(0, 6).map((g) => ({ stage: g.stage, label: g.label, gate_label: g.gate, sort: g.sort, n: 4, n_done: g.sort < p.stage_sort ? 4 : g.sort === p.stage_sort ? 2 : 0, done_at: g.sort < p.stage_sort ? iso(-10) : null, passed: g.sort < (p.stage_sort ?? 1), due: null })),
    checklist: [
      { stage: p.stage, stage_label: p.stage_label, stage_sort: p.stage_sort, sort: 1, template_id: 1, label: 'Ontwerp besproken met de klant', automatic: false, done: true, done_at: iso(-3), done_by: 'Olivier', na: false, skipped: false },
      { stage: p.stage, stage_label: p.stage_label, stage_sort: p.stage_sort, sort: 2, template_id: 2, label: 'Kosten berekend', automatic: true, done: true, done_at: iso(-1), done_by: null, na: false, skipped: false },
      { stage: p.stage, stage_label: p.stage_label, stage_sort: p.stage_sort, sort: 3, template_id: 3, label: 'Alle prijzen ingevuld', automatic: true, done: false, done_at: null, done_by: null, na: false, skipped: false },
      { stage: p.stage, stage_label: p.stage_label, stage_sort: p.stage_sort, sort: 4, template_id: 4, label: 'Offerte verstuurd', automatic: true, done: false, done_at: null, done_by: null, na: false, skipped: false },
      { stage: p.stage, stage_label: p.stage_label, stage_sort: p.stage_sort, sort: 0, template_id: 5, label: 'Maten gekend', automatic: true, done: false, done_at: null, done_by: null, na: false, skipped: false },
      { stage: 'lead', stage_label: 'Aanvraag', stage_sort: 1, sort: 20, template_id: 6, label: 'Vragenlijst ingediend door de klant', automatic: true, done: false, done_at: null, done_by: null, na: false, skipped: true },
      { stage: 'lead', stage_label: 'Aanvraag', stage_sort: 1, sort: 10, template_id: 7, label: 'Kennismaking gehad', automatic: true, done: true, done_at: iso(-12), done_by: 'automatisch', na: false, skipped: false },
    ],
    templates: [{ id: 1, auto_rule: null, agenda_words: null }, { id: 2, auto_rule: 'costs_done', agenda_words: null }, { id: 3, auto_rule: 'prices_complete', agenda_words: null }, { id: 4, auto_rule: 'quote_sent', agenda_words: null }, { id: 5, auto_rule: 'measures_known', agenda_words: 'opmeting, opmeten' }, { id: 6, auto_rule: 'survey_submitted', agenda_words: null }, { id: 7, auto_rule: 'intro_done', agenda_words: null }],
    today: today.filter((t) => t.project_code === code),
    orders: orders.filter((o) => o.project_code === code),
    partner: null,
    tasks: tasks.filter((t) => t.project_code === code),
    quotes: [],
    cost_groups: [{ cost: 1234.5, n_no_price: 4, n_lines: 40 }],
    invoices: [],
    ledger: [],
    jobs_ahead: jobs.filter((j) => j.project_code === code).length,
  }
}

const tables = {
  app_client_status: [{ client_id: 'c1', status: 'klant' }, { client_id: 'c2', status: 'aanvrager' }, { client_id: 'c3', status: 'klant' }, { client_id: 'c4', status: 'niet doorgegaan' }],
  app_projects: projects, project_phases: phases, today_categories: cats, clients, partners, subcontractors, jobs, tasks,
  von_proposals: proposals, app_mail_messages: mails, mail_messages: mails, app_orders: orders, app_invoices: invoices, rule_settings: rules,
  app_partner_orders: [
    { project_code: '209903', partner: 'Zaagatelier Voorbeeld', id: 'po1', status: 'doorgegeven', sent_at: iso(-2), pickup_date: day(5), pickup_default: false, pickup_slot: 'voormiddag', pickup_answer: null, ready_at: null, picked_up_at: null, n_open: 0, n_ordered: 1, n_in: 1, send_by: day(-3), late: false },
  ],
  order_lines: [
    { id: 'l1', category: 'Platen', description: 'Wit melamine 18 mm 2800x2070', article_no: 'WM18', qty: 6, unit: 'plaat', total: 180 },
    { id: 'l2', category: 'Platen', description: 'Eiken fineer MDF 19 mm', article_no: 'EF19', qty: 4, unit: 'plaat', total: 120 },
    { id: 'l3', category: 'Platen', description: 'Wit melamine 8 mm', article_no: 'WM8', qty: 2, unit: 'plaat', total: 21 },
  ],
  agents, app_agent_usage: agents, app_agent_activity: activity, app_capacity_weeks: capacity,
  app_project_progress: [{ project_code: '209901', stage_total: 4, stage_done: 2, total: 20, done: 8, next_item: 'Alle prijzen ingevuld' }, { project_code: '209903', stage_total: 3, stage_done: 1, total: 20, done: 14, next_item: 'Productie klaar' }],
  app_project_planning: [{ project_code: '209901', jobs_open: 1, jobs_unconfirmed: 1, jobs_changed: 0, next_at: iso(2, 8), next_title: 'Stopcontacten eiland' }],
  von_action_types: [{ kind: 'mail_reply', area: 'klanten', label: 'Antwoord op mail', outward: true, undoable: false }, { kind: 'project_update', area: 'projecten', label: 'Project bijwerken', outward: false, undoable: true }],
  agent_routes: [{ event_kind: 'mail_in', agent_id: 'inbox', enabled: true, note: null }],
  backup_runs: [{ started_at: iso(-2, 3), finished_at: iso(-2, 3), ok: true, message: null }],
  secret_expiry: [{ name: 'Voorbeeldsleutel A', expires_on: day(300), used_by: 'mail' }, { name: 'Voorbeeldsleutel B', expires_on: day(30), used_by: 'agenda' }],
  agent_runs: [{ cost_usd: 1.23, created_at: iso(-1), question: 'Wat moet ik vandaag doen?', answer: 'Drie dingen…' }],
  mail_events: [{ email_id: 'e1', status: 'delivered', to: 'jan@voorbeeld.be', subject: 'Uitnodiging', created_at: iso(-1), seen: false }],
  events: [{ id: 1, at: iso(-1), kind: 'versie', importance: 2, project_code: '209901', title: 'Nieuwe versie v3', detail: null, actor: 'PaletteCAD' }],
  design_versions: [{ id: 'dv3', version: 3, received_at: iso(-1), scene_title: 'Keuken v3', n_cabinets: 14, n_parts: 312, n_errors: 1, n_warnings: 3, project: { customer: 'Jan Peeters', street: 'Dorpsstraat 1', city: 'Brussel', drawn_by: 'OV' }, optimizer_status: 'klaar', optimizer_at: iso(-1), cutplan_path: '209901/v3-zaagplan.html', cost_status: 'klaar', project_code: '209901' }],
  app_version_summary: [{ design_version_id: 'dv3', n_cabinets: 14, n_parts: 312, n_sheets: 9, edge_m: 120 }],
  app_cost_summary: [{ design_version_id: 'dv3', category: 'Platen', amount: 800 }, { design_version_id: 'dv3', category: 'Beslag', amount: 200 }],
  app_cabinets: [{ kind_label: 'Kasten', kind_prio: 1, name: '1_onderkast', width_mm: 600, height_mm: 720, depth_mm: 560 }, { kind_label: 'Kasten', kind_prio: 1, name: '2_hoge kast', width_mm: 600, height_mm: 2100, depth_mm: 560 }],
  app_project_cost_groups: [{ project_code: '209901', group_name: 'Werkblad', sort: 1, client_title: 'Werkblad', client_text: null, vat_rate: null, margin_pct: null, show_lines: true, is_custom: false, n_lines: 2, cost: 300, n_no_price: 1, group_id: null }],
  app_project_cost: [{ project_code: '209901', kind: 'stuklijst', id: 'cl1', group_name: 'Werkblad', rubriek: 'Uitbesteed', sort: 1, description: 'Werkblad solid wit', explanation: null, supplier: 'Werkbladfirma', article_no: null, qty: 1, unit: 'stuk', unit_price: 0, total: 0, note: 'prijs ontbreekt: offerte van Werkbladfirma', line_key: 'NAAM:werkblad solid wit', no_price: true, in_stock: false, duplicate: false, source: 'stuklijst', source_ref: '1', version: 3, default_group: 'Werkblad', design_version_id: 'dv3' },
    { project_code: '209901', kind: 'stuklijst', id: 'cl2', group_name: 'Werkblad', rubriek: 'Platen', sort: 2, description: 'Solid grijs', explanation: null, supplier: 'Voorbeeldhout', article_no: 'S1', qty: 1, unit: 'plaat', unit_price: 300, total: 300, note: null, line_key: 'ART:S1', no_price: false, in_stock: false, duplicate: false, source: 'stuklijst', source_ref: null, version: 3, default_group: 'Werkblad', plate_key: 'solid grijs|12', design_version_id: 'dv3' }],
  plate_stock: [{ project_code: '209901', family: 'eik fineer', thickness_mm: 19 }],
  plate_execution: [],
  project_outsourcing: [{ id: 1, project_code: '209901', family: 'solid wit', material_label: 'Solid wit', firm: 'Werkbladfirma', amount: 1250.5, description: 'Werkblad solid wit', quote_ref: 'W-12' }],
  app_sheets: [
    { id: 'sh1', material_label: 'Eik fineer', thickness_mm: 19, length_mm: 2800, width_mm: 2070, qty: 4, yield_pct: 81, price_per_sheet: 50, format_source: 'prijslijst', supplier: 'Voorbeeldhout', article_no: 'A1', ordered_by: 'Partner', cost: 200,
      data: { family: 'eik fineer', plan: '4× 2800×2070 + 1× 3050×1220', plan_cost: 245, suppliers: ['Voorbeeldhout'], reasons: ['1 onderdeel past niet op 2800×2070 (Zijwand 3000×600) → 3050×1220', 'voordeligste: € 245,00; daarna Houthandel B 5× 2800×2070 € 260,00'],
        locked: null, primary: { supplier: 'Voorbeeldhout', length_mm: 2800, width_mm: 2070 }, alternatives: [
          { plan: '4× 2800×2070 + 1× 3050×1220', suppliers: ['Voorbeeldhout'], supplier: 'Voorbeeldhout', length_mm: 2800, width_mm: 2070, count: 5, cost: 245, unfit: 0, chosen: true },
          { plan: '7× 3050×1220', suppliers: ['Voorbeeldhout'], supplier: 'Voorbeeldhout', length_mm: 3050, width_mm: 1220, count: 7, cost: 290, unfit: 0, chosen: false },
          { plan: '5× 2800×2070', suppliers: ['Houthandel B'], supplier: 'Houthandel B', length_mm: 2800, width_mm: 2070, count: 5, cost: 260, unfit: 1, chosen: false }] } },
    { id: 'sh2', material_label: 'Eik fineer', thickness_mm: 19, length_mm: 3050, width_mm: 1220, qty: 1, yield_pct: 40, price_per_sheet: 45, format_source: 'prijslijst', supplier: 'Voorbeeldhout', article_no: 'A2', ordered_by: 'Partner', cost: 45,
      data: { family: 'eik fineer', plan: '4× 2800×2070 + 1× 3050×1220', plan_cost: 245, suppliers: ['Voorbeeldhout'], reasons: [], alternatives: [], primary: { supplier: 'Voorbeeldhout', length_mm: 2800, width_mm: 2070 } } },
  ],
  app_parts_summary: [{ material_label: 'Eik fineer', thickness_mm: 19, n_parts: 120, area_m2: 18.2 }],
  cost_lines: [
    { id: 'cl1', category: 'Platen', subgroup: null, sort: 1, description: 'Eik fineer', supplier: 'Voorbeeldhout', article_no: 'A1', qty: 4, unit: 'plaat', unit_price: 50, total: 200, ordered_by: 'Partner', note: null },
    { id: 'cl2', category: 'Kanten', subgroup: null, sort: 2, description: 'Kant eik 23 mm', supplier: 'Kantenhandel', article_no: 'K23', qty: 120, unit: 'm', unit_price: 0.85, total: 102, ordered_by: 'Partner', note: 'goedkoopste: rol van 50 m' },
    { id: 'cl3', category: 'Verbinders & Beslagen', subgroup: null, sort: 3, description: 'Scharnier 110°', supplier: 'Beslaghandel', article_no: 'S110', qty: 24, unit: 'stuk', unit_price: 3.2, total: 76.8, ordered_by: 'Vonstruct', note: null },
    { id: 'cl4', category: 'Verbinders & Beslagen', subgroup: null, sort: 4, description: 'Greep 400', supplier: null, article_no: null, qty: 6, unit: 'stuk', unit_price: null, total: 0, ordered_by: 'Vonstruct', note: 'prijs ontbreekt: geen artikelnummer' },
    { id: 'cl5', category: 'Productiekosten', subgroup: null, sort: 5, description: 'Nesting', supplier: 'Partner', article_no: null, qty: 5, unit: 'plaat', unit_price: 45, total: 225, ordered_by: 'Partner', note: null },
    { id: 'cl6', category: 'Grepen', subgroup: null, sort: 100007, description: 'Greep zwart 160 mm', supplier: 'Vonstruct', article_no: 'GZ160', qty: 8, unit: 'stuk', unit_price: 12.5, total: 100, ordered_by: 'Zelf maken', note: 'manueel toegevoegd', details: { extra_id: '7' } },
  ],
  suppliers: [{ name: 'Beslaghandel', active: true }, { name: 'Voorbeeldhout', active: true }, { name: 'Kantenhandel', active: true }],
  project_ignored_items: [{ id: 1, description: 'Scharnier 95° Voorbeeld', article_no: 'S95', category: 'Verbinders & Beslagen', project_code: '209901', active: true }],
  app_supplier_freshness: [{ supplier_name: 'Voorbeeldhout', n_articles: 1200, last_update: iso(-2), days_old: 2 }, { supplier_name: 'Beslaghandel', n_articles: 8000, last_update: iso(-40), days_old: 40 }],
  app_checks: [
    { id: 'ck1', code: 'GEEN_ARTIKELNR', level: 'let op', part: 'Greep 400', message: 'Artikelnummer ontbreekt', resolved: false, resolution: null, normal: false, code_label: 'Beslag zonder artikelnummer' },
    { id: 'ck2', code: 'LOSSE_PLAAT', level: 'let op', part: null, message: '3 platen staan los, niet in een kast', resolved: true, resolution: 'Normaal: losse platen zijn plinten, paslatten …', normal: true, code_label: 'Platen los, niet in een kast' },
    { id: 'ck3', code: 'GEEN_DEELNUMMER', level: 'let op', part: null, message: 'Plaat zonder deelnummer: Legplank', resolved: false, resolution: null, normal: false, code_label: 'Plaat zonder deelnummer' },
  ],
  check_settings: [{ code: 'LOSSE_PLAAT', label: 'Platen los, niet in een kast', normal: true, note: 'losse platen zijn plinten, paslatten …' }, { code: 'GEEN_DEELNUMMER', label: 'Plaat zonder deelnummer', normal: false, note: null }],
  app_capacity_weeks: capacity,
  app_purchase_invoices: [], app_client_ledger: [],
}
const rpc = {
  my_role: 'beheerder', nav_counts: { inbox: 2, von: 1 }, today_items: today, my_display_name: 'Jan Peeters', my_language: 'nl', next_free_install_week: '2099-W14',
  // verzonnen cijfers voor de pagina Cijfers
  report_page: {
    year: 2099,
    money: { invoiced_incl: 10000, received: 8000, open_incl: 2000, n_invoices: 4, last_sync: iso(0) },
    quotes: { sent: 3, signed: 2, declined: 1, signed_excl: 20000, open_excl: 5000, open_n: 1, win_pct: 67 },
    months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, invoiced_incl: i % 3 ? 1000 : 0, received: 500, signed_excl: i === 10 ? 10000 : 0 })),
    pipeline: [
      { stage: 'lead', label: 'Aanvraag', n: 1, n_quote: 0, value_excl: 0 }, { stage: 'design', label: 'Ontwerp', n: 1, n_quote: 0, value_excl: 0 },
      { stage: 'quote', label: 'Offerte', n: 0, n_quote: 0, value_excl: 0 }, { stage: 'signed', label: 'Voorbereiding', n: 0, n_quote: 0, value_excl: 0 },
      { stage: 'production', label: 'Productie', n: 1, n_quote: 1, value_excl: 10000 }, { stage: 'installation', label: 'Plaatsing', n: 0, n_quote: 0, value_excl: 0 },
    ],
    margins: [
      { code: '209903', title: 'Badkamermeubel', client: 'Tom Claes', revenue_excl: 10000, margin_planned: 3000, margin_planned_pct: 30, margin_actual: null, margin_actual_pct: null },
      { code: '209901', title: 'Keuken', client: 'Jan Peeters', revenue_excl: 10000, margin_planned: 2500, margin_planned_pct: 25, margin_actual: 2000, margin_actual_pct: 20 },
    ],
    margin_totals: { n: 2, revenue_excl: 20000, margin_planned: 5500, margin_planned_pct: 27.5, margin_actual: 2000, margin_actual_pct: 20 },
    durations: [{ stage: 'design', n_done: 2, median_done: 6.5, n_now: 1, avg_now: 3 }, { stage: 'production', n_done: 0, median_done: null, n_now: 1, avg_now: 2.5 }],
    durations_since: iso(-5),
  },
}
export { tables, rpc, projectPage, events, iso, day }

// brochure: zelfde vorm als RPC brochure_data
rpc.cost_search2 = [
  { src: 'prijslijst', supplier: 'Beslaghandel', article_no: 'G160Z', description: 'Greep aluminium zwart 160 mm', unit_price: 6.4, unit: 'stuk', ref: '1', seen: null },
  { src: 'eigen', supplier: 'Vonstruct', article_no: 'GZ160', description: 'Greep zwart 160 mm', unit_price: 12.5, unit: 'stuk', ref: 'ART:GZ160', seen: null },
]
rpc.plate_materials_list = [{ name: 'Eik fineer', family: 'eik fineer', thicknesses: [19, 25], formats: '2800x2070', suppliers: 'Voorbeeldhout', price_m2_from: 8.6, n: 2 }]
rpc.plate_families_overview = [
  { family: 'eik fineer', family_name: 'Eik fineer', labels: ['Eik fineer'], aliases: [], used_thickness: [19], projects: ['209901'], n_parts: 40, members: [
    { supplier: 'Voorbeeldhout', sku: 'A1', description: 'Eik fineer 19mm', thickness_mm: 19, length_mm: 2800, width_mm: 2070, price: 50, price_m2: 8.6, protective_film: false, note: null, added: false, excluded_id: null },
    { supplier: 'Houthandel B', sku: 'B7', description: 'Eik fineer 19mm', thickness_mm: 19, length_mm: 2800, width_mm: 2070, price: 52, price_m2: 9, protective_film: false, note: null, added: false, excluded_id: 3 },
    { supplier: 'Voorbeeldhout', sku: 'A9', description: 'Eik fineer 25mm', thickness_mm: 25, length_mm: 2800, width_mm: 2070, price: 70, price_m2: 12, protective_film: false, note: null, added: false, excluded_id: null }] },
  { family: 'hpl eik', family_name: 'HPL Eik', labels: ['HPL Eik'], aliases: [], used_thickness: [0.7], projects: ['209901'], n_parts: 6, members: [] },
]
rpc.brochure_data = { project_code: '209901', title: 'Keuken en berging', intro: null, client: 'Jan Peeters', published: false, company: {}, renders: [], cabinets: [{ name: 'Onderkast', width: 600, depth: 560, height: 720, image: null, text: null }], materials: [], drawers: null, appliances: [] }
// vragenlijst: zelfde vorm als RPC portal_survey
rpc.portal_survey = { project_code: '209901', modules: [{ module: 'keuken', label: 'Keuken' }], questions: [], answers: {}, status: 'open', known: {} }
