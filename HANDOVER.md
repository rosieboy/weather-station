# Överlämning till ChatGPT/Codex

Uppdaterad 2026-09-26. Projektet är en SvelteKit/Svelte 5-dashboard för en
Raspberry Pi-kiosk på **1280 × 720**, med Väder, Rum och Ljud samt mobilvy.
Läs [README.md](README.md) för installation, arkitektur och fullständig
funktionsbeskrivning. [COPILOT.md](COPILOT.md) listar tidigare granskningsfynd;
de är inte åtgärdade av UI-arbetet.

## Vad som ändrades

- Vädervyn har utetemperaturen i fokus, en rad för sekundära mätvärden,
  rumskort och en hel klickbar prognosrad som växlar mellan dygn och timmar.
  Synliga mät- och prognostidsstämplar samt ljudspelarnas tidsrad togs bort.
- De tre sensor-rumskorten i Vädervyn visar temperatur och luftfuktighet med
  samma sifferstorlek och exakt samma vertikala position. Den synliga
  "Luftfuktighet"-etiketten är borttagen men finns kvar för skärmläsare.
- Rum-flikens separata, helt klickbara kort visar lampstatus och stora
  sensorvärden. Dialogen har större switchar och dimmer samt fast feedbackyta så
  den inte hoppar vid kommandon. Lyckade kommandon lämnar ingen statusrad;
  fel och pågående kommandon visas fortfarande.
- Ljudvyn har större transportknappar, en 24 px fylld volymstapel och
  större titel/artist. Volymkommandon skickas först när reglaget släpps.
- Vyerna har egna CSS-färgpaletter för dag och natt. `deep-ambient` använder
  svart och nedtonat rött, även i modaler och reglage. Rum-flikens kort och
  ljudkorten har subtil röd ram/skugga, med tydligare ram vid hover/tryck.

## Kodens ansvar

- [src/routes/+page.svelte](src/routes/+page.svelte): flikval, vädervy,
  prognosväxling, SSE, klocka och temaeffekt på `<html data-theme>`.
- [src/lib/components/RoomsView.svelte](src/lib/components/RoomsView.svelte):
  Rum-flikens kort, dialog och HA-kommandon. Blanda inte ihop dessa kort med
  sensor-rumskorten i vädervyn i `+page.svelte`.
- [src/lib/components/AudioView.svelte](src/lib/components/AudioView.svelte):
  spelarkort, volym, källor och Sonos-gruppering.
- [src/app.css](src/app.css): vy- och tematokens samt responsiva kioskregler.
  De sista `deep-ambient`-reglerna skriver över äldre kortfärger. Den
  gemensamma ambient-regeln nollställer kortens skuggor: nya regler för
  rum-/ljudkort måste ha minst samma specificitet för att slå igenom.
- [src/lib/weather/theme.ts](src/lib/weather/theme.ts) och
  [tests/theme.test.mjs](tests/theme.test.mjs): nattfönstret med gränstester
  för svensk sommar- och vintertid.

## Teman och verifiering

Klockan i `+page.svelte` uppdateras redan varje sekund och använder serverns
tidsförskjutning. `deep-ambient` har företräde **23:00–07:59 i
Europe/Stockholm**, även över manuellt Dag/Natt-val. Från 08:00 återgår
temat till sparat val eller Autos solberäkning. Temaknappen växlar fortfarande
Auto → Natt → Dag; ambient kan inte väljas manuellt. CSS använder de
faktiska attributvärdena `day`, `night` och `deep-ambient` (inte `dag`/`natt`).

Senast verifierat lokalt: `npm test` (24 tester), `npm run check`,
`npm run build`, Prettier och `git diff --check` passerar. Webbläsarvyn har
kontrollerats vid 1280 × 720 och mobilbredder. Vädervyns tre mätvärden
linjerar utan horisontellt överflöde; rummens och ljudets ambient-ramar har
kontrollerats i beräknad CSS. **Ingen ny Pi-installation eller fysisk skärmtest
har gjorts för dessa ändringar.** Verifiera därför kioskens ljusstyrka,
läsbarhet och touch på själva Pi:n, särskilt kring 23:00 och 08:00.

Undvik att skicka styrkommandon till live-HA/Sonos bara för att testa UI.
Vid behov: mocka kontroll-API:erna i webbläsaren. Publicering/deploy till Pi
är en separat åtgärd; se [RASPBERRY-PI.md](RASPBERRY-PI.md).
