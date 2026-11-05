# Vonstruct webapp (instructies voor Claude)

Webapp van Vonstruct (Vite + React + Supabase), gepubliceerd via GitHub Pages. Elke push naar `main` publiceert automatisch (workflow "Webapp publiceren").

## Eerst lezen

Deze repo is **publiek**. De volledige notities staan in de privé-repo **vonstruct/platform**:

- `CLAUDE.md`: architectuur, Supabase, optimizer, open punten;
- `notities/app.md`: alles over deze app (modules, tabellen, views, werking).

Clone vonstruct/platform bij elke sessie en lees die twee bestanden voor je iets wijzigt. Nieuwe notities over de app schrijf je in `notities/app.md` van platform, **nooit hier**.

## Nooit in deze repo

- Geheimen (service key, API-sleutels, tokens, wachtwoorden). Enkel de publieke (publishable) Supabase-sleutel; de beveiliging zit in de login en de rijbeveiliging in Supabase.
- Namen, e-mailadressen, telefoonnummers of adressen van klanten, partners of onderaannemers, ook niet als voorbeeld in de code (gebruik verzonnen namen zoals "Jan Peeters").
- Projectcodes, bedragen, prijzen, marges of andere bedrijfsdetails.

## Principes

- De app rekent niet: berekeningen zitten in Supabase (views en functies). De app toont en bewaart keuzes.
- Regels zijn gegevens (Supabase-tabellen), aanpasbaar in de module Rekenregels.

## Structuur

```
src/
  core/        gedeelde kern: supabase, login, layout, tabellen, opmaak
  modules/     één map per module; registry.ts = menu
  portal/      portaal voor klanten, partners en onderaannemers
```

Nieuwe module: map `src/modules/<naam>/` met een `index.ts` die een `AppModule` exporteert, en één regel in `registry.ts`.

## Ontwikkelen

```
npm install
npm run dev
```

## Voor Claude

- Antwoord Olivier in het Nederlands, kort. Hij is geen programmeur.
