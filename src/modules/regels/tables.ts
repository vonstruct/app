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
    section: 'Prijzen',
    table: 'manual_prices',
    title: 'Eigen prijzen',
    explanation:
      'Prijzen die je zelf invult, ook via het tabblad Kosten van een versie. Ze gaan voor op de prijslijsten van de leveranciers en gelden voor alle projecten. Herkenning op artikelnummer, of op naam als er geen artikelnummer is. Prijs = per stuk, zonder btw.',
    columns: [
      { key: 'description', label: 'Omschrijving' },
      { key: 'article_no', label: 'Artikelnummer' },
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
