import type { EditCol } from '../../core/EditableTable'

export type RuleTable = {
  section: string
  table: string
  title: string
  explanation: string
  columns: EditCol[]
  orderBy?: string
  newRow?: Record<string, unknown>
  keyField?: string
  canAdd?: boolean
  canDelete?: boolean
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
    table: 'project_requirements',
    title: 'Gegevens per fase',
    explanation:
      'Welke gegevens vanaf welke fase ingevuld moeten zijn. Ontbreekt er iets bij een project dat in die fase of later zit, dan staat het in Vandaag en in het Verloop van het project, met een knop om het in te vullen. Fase: lead = Aanvraag, design = Ontwerp, quote = Offerte, signed = Voorbereiding, production = Productie, installation = Plaatsing. Gegeven: werf_gemeente, werf_adres (straat, postcode en gemeente van de werf), klant_adres (facturatieadres), klant_telefoon, klant_email, plaatsing_of_deadline (plaatsing, plaatsingsweek, start van de werken of deadline), plaatsingsdatum, deadline. Zet Actief uit om een regel niet meer te gebruiken.',
    columns: [
      { key: 'stage', label: 'Vanaf fase', type: 'select', options: ['lead', 'design', 'quote', 'signed', 'production', 'installation'], width: 130 },
      { key: 'field', label: 'Gegeven', type: 'select', options: ['werf_gemeente', 'werf_adres', 'klant_adres', 'klant_telefoon', 'klant_email', 'plaatsing_of_deadline', 'plaatsingsdatum', 'deadline'], width: 190 },
      { key: 'label', label: 'Zo staat het in Vandaag' },
      { key: 'sort', label: 'Volgorde', type: 'number', width: 90 },
      { key: 'active', label: 'Actief', type: 'bool', width: 70 },
    ],
    orderBy: 'sort',
    newRow: { stage: 'quote', field: 'klant_email', label: 'e-mailadres van de klant', sort: 100, active: true },
  },
  {
    section: 'Checklist',
    table: 'checklist_template',
    title: 'Projectchecklist',
    explanation:
      'De standaardpunten per fase die je bij elk project ziet. Fase: lead = Aanvraag, design = Ontwerp, quote = Offerte, signed = Voorbereiding, production = Productie, installation = Plaatsing. Punten met een automatische regel vinken vanzelf af (kennismaking, vragenlijst, go = project gaat door, ontwerpversie, kosten, prijzen, offerte verstuurd/getekend, voorschot betaald, bestellingen geplaatst/ontvangen, opdrachten bevestigd/klaar, PV getekend, werkpunten af, eindfactuur, review gevraagd). Automatisch = agenda: het punt vinkt af na een afspraak of opdracht van het project met een van de woorden (gescheiden door een komma) in de titel, bv. "opmeting, opmeten"; het woord moet vooraan staan, dus "opmeting" telt niet voor "eindopmeting". Je kan zo een punt ook altijd met de hand afvinken. measures_known = maten gekend: na een afspraak met een van de woorden of als de klant de vragenlijst indient; met de hand kies je waar de maten vandaan komen. Laat Automatisch leeg om enkel met de hand af te vinken. Zet Actief uit om een punt niet meer te tonen. Harde stap (bv. offerte getekend, voorschot betaald): wordt nooit vanzelf n.v.t. als een project een fase overslaat; blijft open en komt op Vandaag tot hij gedaan is of je hem bewust op n.v.t. zet. Optioneel (bv. vragenlijst): telt niet mee in de teller van de fase en staat niet bij "nu"; is hij toch gedaan, dan telt hij wel mee.',
    columns: [
      { key: 'stage', label: 'Fase', type: 'select', options: ['lead', 'design', 'quote', 'signed', 'production', 'installation'], width: 120 },
      { key: 'sort', label: 'Volgorde', type: 'number', width: 90 },
      { key: 'label', label: 'Punt' },
      { key: 'auto_rule', label: 'Automatisch', type: 'select', options: ['', 'agenda', 'measures_known', 'intro_done', 'survey_submitted', 'go_given', 'design_version', 'costs_done', 'prices_complete', 'quote_sent', 'quote_signed', 'deposit_paid', 'orders_placed', 'orders_received', 'install_week_set', 'production_done', 'pickup_done', 'package_sent', 'jobs_confirmed', 'jobs_done', 'handover_signed', 'punch_done', 'final_invoice', 'review_requested'], width: 150 },
      { key: 'agenda_words', label: 'Woorden in de agenda', placeholder: 'bij Automatisch = agenda' },
      { key: 'hard', label: 'Harde stap', type: 'bool', width: 90 },
      { key: 'optional', label: 'Optioneel', type: 'bool', width: 90 },
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
    section: 'Prijzen',
    table: 'stock_articles',
    title: 'Op voorraad',
    explanation:
      'Artikels die je liggen hebt. Ze tellen mee in de kostprijs (aan de prijs van de prijslijst) maar komen niet op een bestellijst, in alle projecten. Aanduiden doe je in Projectkost of bij een bestelling (knop "op voorraad" per artikel). Vinkje Op voorraad uit = weer gewoon bestellen.',
    columns: [
      { key: 'description', label: 'Omschrijving' },
      { key: 'article_no', label: 'Artikelnummer', width: 150 },
      { key: 'supplier', label: 'Leverancier', width: 160 },
      { key: 'active', label: 'Op voorraad', type: 'bool', width: 100 },
      { key: 'note', label: 'Opmerking' },
    ],
    orderBy: 'description',
    keyField: 'price_key',
    canAdd: false,
    canDelete: false,
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
      { key: 'ordered_by', label: 'Besteld door', type: 'select', options: ['', 'Vonstruct'], optionsFrom: { table: 'partners', column: 'name' }, width: 120 },
      { key: 'lead_days', label: 'Levertijd (dagen, 0 = voorraad)', type: 'number', width: 120 },
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
      'Extra formaten bovenop de prijslijsten (Plaatmaterialen hierboven): een formaat dat niet in de prijslijst staat, een eigen prijs, of een materiaal zonder prijslijst (bv. HPL). De optimizer weegt ze mee en kiest het voordeligste zaagplan. Materiaal = naam zoals in PaletteCAD (het begin volstaat) of artikelnummer. Prijs leeg = geschat met de laagste m²-prijs van dat materiaal. Leverancier leeg = de vaste leverancier of de catalogusleverancier.',
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
