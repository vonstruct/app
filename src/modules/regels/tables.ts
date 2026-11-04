import type { EditCol } from '../../core/EditableTable'

export type RuleTable = {
  section: string
  table: string
  title: string
  explanation: string
  columns: EditCol[]
  orderBy?: string
  newRow?: Record<string, unknown>
}

/** Regeltabellen per onderdeel. Nieuwe tabel: hier één blok toevoegen. */
export const ruleTables: RuleTable[] = [
  {
    section: 'Brochure',
    table: 'material_public_names',
    title: 'Publieke namen van materialen',
    explanation: 'Wat de klant in de brochure ziet in plaats van de technische naam. "Herkennen aan" = een stuk van de technische naam (bv. 49D of Lissa Oak). Decorbeeld = een webadres van een afbeelding (bv. van de leverancier).',
    columns: [
      { key: 'match', label: 'Herkennen aan' },
      { key: 'public_name', label: 'Publieke naam' },
      { key: 'family', label: 'Familie', width: 140 },
      { key: 'description', label: 'Uitleg' },
      { key: 'care', label: 'Onderhoud' },
      { key: 'image_url', label: 'Decorbeeld (link)' },
      { key: 'active', label: 'Actief', type: 'bool', width: 70 },
    ],
    orderBy: 'public_name',
    newRow: { match: 'deel van de naam', public_name: 'Naam voor de klant', active: true },
  },
  {
    section: 'Offerte',
    table: 'quote_line_templates',
    title: 'Vaste regels op elke offerte',
    explanation: 'Deze regels komen automatisch op elke nieuwe offerte (bv. finale opmeting, ontwerp en installatie, transport). Prijs 0 = per offerte in te vullen. Soort dienst = rubriek "Ontwerp, plaatsing en transport".',
    columns: [
      { key: 'sort', label: 'Volgorde', type: 'number', width: 90 },
      { key: 'title', label: 'Titel' },
      { key: 'description', label: 'Omschrijving' },
      { key: 'qty', label: 'Aantal', type: 'number', width: 80 },
      { key: 'unit_price', label: 'Prijs excl. (€)', type: 'number', width: 110 },
      { key: 'kind', label: 'Soort', type: 'select', options: ['dienst', 'vrij', 'sanitair', 'toestel'], width: 110 },
      { key: 'active', label: 'Actief', type: 'bool', width: 70 },
    ],
    orderBy: 'sort',
    newRow: { sort: 830, title: 'Nieuwe vaste regel', qty: 1, unit_price: 0, kind: 'dienst', active: true },
  },
  {
    section: 'Checklist',
    table: 'checklist_template',
    title: 'Projectchecklist',
    explanation:
      'De standaardpunten per fase die je bij elk project ziet. Fase: lead = Aanvraag, design = Ontwerp, quote = Offerte, signed = Voorbereiding, production = Productie, installation = Plaatsing. Punten met een automatische regel vinken vanzelf af (kennismaking, vragenlijst, go, ontwerpversie, kosten, prijzen, offerte verstuurd/getekend, voorschot betaald, bestellingen geplaatst/ontvangen, opdrachten bevestigd/klaar, PV getekend, werkpunten af, eindfactuur, review gevraagd); laat dat veld leeg om met de hand af te vinken. Zet Actief uit om een punt niet meer te tonen.',
    columns: [
      { key: 'stage', label: 'Fase', type: 'select', options: ['lead', 'design', 'quote', 'signed', 'production', 'installation'], width: 120 },
      { key: 'sort', label: 'Volgorde', type: 'number', width: 90 },
      { key: 'label', label: 'Punt' },
      { key: 'auto_rule', label: 'Automatisch', type: 'select', options: ['', 'intro_done', 'survey_submitted', 'go_given', 'design_version', 'costs_done', 'prices_complete', 'quote_sent', 'quote_signed', 'deposit_paid', 'orders_placed', 'orders_received', 'install_week_set', 'production_done', 'pickup_done', 'jobs_confirmed', 'jobs_done', 'handover_signed', 'punch_done', 'final_invoice', 'review_requested'], width: 150 },
      { key: 'active', label: 'Actief', type: 'bool', width: 70 },
    ],
    orderBy: 'stage',
    newRow: { stage: 'design', sort: 100, label: 'Nieuw punt', active: true },
  },
  {
    section: 'Berichten',
    table: 'message_templates',
    title: 'Berichten aan klanten',
    explanation:
      'Teksten voor WhatsApp en mail. Tussen accolades wordt automatisch ingevuld: {voornaam}, {naam}, {projectcode}, {link} (de portaallink) en {email}. Betalingsherinnering: ook {factuur} {datum} {bedrag} {vervaldag} {rekening}.',
    columns: [
      { key: 'label', label: 'Bericht', width: 220 },
      { key: 'lang', label: 'Taal', type: 'select', options: ['nl', 'en', 'de'], width: 70 },
      { key: 'subject', label: 'Onderwerp (mail)', width: 200 },
      { key: 'body', label: 'Tekst', type: 'textarea' },
    ],
    orderBy: 'id',
    newRow: { key: 'nieuw_' + Date.now(), lang: 'nl', label: 'Nieuw bericht', body: '' },
  },
  {
    section: 'Prijzen',
    table: 'manual_prices',
    title: 'Eigen artikels',
    explanation:
      'Artikels met een eigen prijs en herkomst, ook in te vullen via de tabbladen Kosten en Controle. Ze gaan voor op de prijslijsten en gelden voor alle projecten. Herkenning op artikelnummer, of op naam als er geen artikelnummer is (de naam moet dan exact zo in PaletteCAD staan). Herkomst: Bestellen = bij een leverancier; Zelf maken = eigen rubriek in de kosten, niet op bestellijsten; Negeren = telt nergens mee. Prijs = per stuk, zonder btw.',
    columns: [
      { key: 'description', label: 'Omschrijving' },
      { key: 'article_no', label: 'Artikelnummer' },
      { key: 'origin', label: 'Herkomst', type: 'select', options: ['Bestellen', 'Zelf maken', 'Negeren'], width: 130 },
      { key: 'supplier', label: 'Leverancier' },
      { key: 'price', label: 'Prijs per stuk (€)', type: 'number', width: 130 },
      { key: 'note', label: 'Opmerking' },
    ],
    orderBy: 'description',
    newRow: { description: 'nieuw artikel', price: 0 },
  },
  {
    section: 'Bestellen',
    table: 'material_choices',
    title: 'Leverancier en besteld door per materiaal',
    explanation: 'Zoals het venster "Besteld door" in de stuklijst. Materiaal = naam zoals in PaletteCAD (het begin volstaat). Niet in de lijst = standaardregel hierboven.',
    columns: [
      { key: 'kind', label: 'Soort', type: 'select', options: ['plaat', 'kant'], width: 90 },
      { key: 'material', label: 'Materiaal' },
      { key: 'supplier', label: 'Leverancier', type: 'select', options: ['', 'Baars & Bloemhoff', 'Cras', 'Ostermann Belux', 'Rehau'] },
      { key: 'ordered_by', label: 'Besteld door', type: 'select', options: ['', 'partner', 'Zelf'], width: 120 },
      { key: 'note', label: 'Opmerking' },
    ],
    orderBy: 'material',
    newRow: { kind: 'plaat', material: 'nieuw materiaal' },
  },
  {
    section: 'Platen',
    table: 'material_exclusions',
    title: 'Materialen die niet als plaat of kant tellen',
    explanation: 'Deze materialen komen niet in Platen en Kanten, en dus ook niet in nesting, afkanten of commissie.',
    columns: [
      { key: 'match_type', label: 'Naam', type: 'select', options: ['begint met', 'bevat'], width: 130 },
      { key: 'text', label: 'Tekst' },
      { key: 'note', label: 'Opmerking' },
    ],
    newRow: { match_type: 'begint met', text: 'nieuw' },
  },
  {
    section: 'Plaatoptimalisatie',
    table: 'sheet_formats',
    title: 'Plaatformaten',
    explanation:
      'Per materiaal de formaten die je kan bestellen. De optimalisatie kiest de combinatie met de laagste kost. Materiaal = naam zoals in PaletteCAD (het begin volstaat) of artikelnummer. Prijs leeg = m²-prijs van de leverancier.',
    columns: [
      { key: 'material', label: 'Materiaal' },
      { key: 'length_mm', label: 'Lengte (mm)', type: 'number', width: 110 },
      { key: 'width_mm', label: 'Breedte (mm)', type: 'number', width: 110 },
      { key: 'price_per_sheet', label: 'Prijs per plaat (€)', type: 'number', width: 140 },
      { key: 'supplier', label: 'Leverancier' },
      { key: 'article_no', label: 'Artikelnummer' },
      { key: 'active', label: 'Actief', type: 'bool', width: 70 },
    ],
    orderBy: 'material',
    newRow: { material: 'nieuw materiaal', length_mm: 2800, width_mm: 2070, active: true },
  },
  {
    section: 'Bestellen',
    table: 'suppliers',
    title: 'Levertermijnen',
    explanation: 'Levertermijn in werkdagen per leverancier. Leeg = de standaard uit de regel hierboven. Gebruikt om "bestellen vóór" te berekenen.',
    columns: [
      { key: 'name', label: 'Leverancier' },
      { key: 'lead_time_days', label: 'Levertermijn (werkdagen)', type: 'number', width: 170 },
      { key: 'active', label: 'Actief', type: 'bool', width: 70 },
    ],
    orderBy: 'name',
    newRow: { name: 'Nieuwe leverancier', active: true },
  },
  {
    section: 'Bestellen',
    table: 'supplier_fees',
    title: 'Leverancierskosten',
    explanation: 'Afrolkosten, verzendkosten en toeslagen per leverancier. "Onder" = alleen als de bestelling kleiner is dan dit bedrag.',
    columns: [
      { key: 'supplier_name', label: 'Leverancier' },
      { key: 'fee', label: 'Kost' },
      { key: 'amount', label: 'Bedrag (€)', type: 'number', width: 100 },
      { key: 'per', label: 'Per', type: 'select', options: ['order', 'order_line'], width: 110 },
      { key: 'threshold', label: 'Onder (€)', type: 'number', width: 100 },
      { key: 'condition', label: 'Wanneer' },
    ],
    orderBy: 'supplier_name',
    newRow: { supplier_name: 'Leverancier', fee: 'Kost', amount: 0, per: 'order' },
  },
  {
    section: 'Kasten',
    table: 'cabinet_kind_rules',
    title: 'Wat is een kast?',
    explanation: 'Topobjecten worden ingedeeld volgens hun catalogusmap in PaletteCAD. % = om het even welke tekst. Lagere prioriteit wint.',
    columns: [
      { key: 'match_catalog', label: 'Catalogusmap bevat' },
      { key: 'kind', label: 'Soort', type: 'select', options: ['kast', 'plint', 'greep', 'werkblad', 'overig'], width: 110 },
      { key: 'label', label: 'Naam in de app' },
      { key: 'prio', label: 'Prioriteit', type: 'number', width: 90 },
    ],
    orderBy: 'prio',
    newRow: { match_catalog: '%\\Nieuwe map%', kind: 'overig', label: 'Nieuwe soort', prio: 100 },
  },
  {
    section: 'Kasten',
    table: 'cabinet_name_codes',
    title: 'Codes in kastnamen',
    explanation: 'Voor de korte omschrijving van een kast in offerte en brochure (bv. "OK 60 L" = onderkast, draairichting links).',
    columns: [
      { key: 'code', label: 'Code', width: 100 },
      { key: 'meaning', label: 'Betekenis' },
      { key: 'sort', label: 'Volgorde', type: 'number', width: 90 },
    ],
    orderBy: 'sort',
    newRow: { code: 'NIEUW', meaning: 'betekenis', sort: 200 },
  },
]
