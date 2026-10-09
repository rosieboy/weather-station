# Överlämning till ChatGPT/Codex

Uppdaterad 2026-10-10. Projektet är en SvelteKit/Svelte 5-dashboard för en
Raspberry Pi-kiosk på **1280 × 720**, med Väder, Rum, Ljud, Kalender och Bil samt mobilvy.
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
tidsförskjutning. Temaknappen växlar Dag → Natt → Ambient → Auto och valet sparas
i webbläsaren. De manuella lägena är fasta. Auto väljer `deep-ambient`
**23:00–07:59 i Europe/Stockholm** och använder annars solberäknat dag/nattläge.
CSS använder de
faktiska attributvärdena `day`, `night` och `deep-ambient` (inte `dag`/`natt`).

Senast verifierat för Bil-vyn: `npm test` (46 tester), `npm run check` och
`npm run build` passerar. Bil-vyn är installerad på Pi:n och användaren har
bekräftat att den fungerar på den fysiska kioskskärmen efter kioskomstart.
Kalenderns flerdagshändelser visas på varje överlappande dag. Dashboarden återgår
till Väder efter fem minuter utan interaktion, oavsett vald vy.

Bil-vyn finns i `CarView.svelte`, `/api/car` och `car-model.ts`. Den läser fasta
`sensor.polestar_*` via den befintliga HA-strömmen. Bilsidan hämtar den cachen var
30:e sekund när den är synlig; det gör inga extra anrop till Polestar.
Bakgrunden ligger i `static/polestar.jpg`. Saknade värden visas som streck och
bilens batterirapporteringstid visas separat, med varning efter ett dygn.
Polestar Data Portal 0.3.0 är manuellt installerad i HA utanför detta repo.
Nuvarande API-credential löper ut 2026-12-16. Hemligheter finns endast i HA.

[DRIFT.md](DRIFT.md) har verifierade manuella kommandon. `scripts/pi/restart-kiosk.py`
kapslar fjärromstarten med den körande kioskens Wayland-miljö, utan sudo;
`--check` gör endast kontroll. Pi-repot ligger i `~/weather-station`,
HA/Matter i `~/home-assistant`. SSH-nyckeln på Macen är `~/.ssh/id_raspberry`.

Undvik att skicka styrkommandon till live-HA/Sonos bara för att testa UI.
Vid behov: mocka kontroll-API:erna i webbläsaren. Publicering/deploy till Pi
är en separat åtgärd; se [RASPBERRY-PI.md](RASPBERRY-PI.md).
