# Vonstruct webapp

Webapp voor Vonstruct: projecten, ontwerpversies uit PaletteCAD (stuklijst Vonstruct_Export), en straks kosten, offerte, bestellingen en brochure.

Live: https://vonstruct.github.io/app/ (login vereist).

## Principes

- **De app rekent niet.** Alle berekeningen zitten in Supabase (views en functies). De app toont en bewaart keuzes.
- **Regels zijn gegevens.** Tarieven, laderegels, plaatformaten … staan in Supabase-tabellen en zijn aanpasbaar in de module Regels.
- **Geen geheimen in deze repo.** Alleen de publieke (publishable) Supabase-sleutel; toegang loopt via login + rijbeveiliging (`is_app_user()`, tabel `app_users`).

## Structuur

```
src/
  core/        gedeelde kern: supabase, login, layout, DataTable, opmaak
  modules/
    registry.ts   lijst van modules (= menu)
    projecten/    projecten, versies, vergelijken
      tabs/       tabbladen van een versie (index.ts = lijst)
    regels/       rekenregels beheren
```

Nieuwe module: map `src/modules/<naam>/` met een `index.ts` die een `AppModule` exporteert, en één regel in `registry.ts`.
Nieuw tabblad bij een versie: component in `projecten/tabs/` en één regel in `tabs/index.ts`.

## Ontwikkelen

```
npm install
npm run dev
```

Elke push naar `main` publiceert automatisch via GitHub Actions (workflow "Webapp publiceren").
