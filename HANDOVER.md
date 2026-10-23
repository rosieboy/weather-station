# Överlämning till ChatGPT/Codex

Svenska · [English](HANDOVER.en.md)

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

Senast verifierat för Bil-vyn: `npm test` (49 tester), `npm run check` och
`npm run build` passerar. Bil-vyn är installerad på Pi:n och användaren har
bekräftat att den fungerar på den fysiska kioskskärmen efter kioskomstart.
Kalenderns flerdagshändelser visas på varje överlappande dag. Dashboarden återgår
till Väder efter fem minuter utan interaktion, oavsett vald vy.

Bil-vyn finns i `CarView.svelte`, `/api/car` och `car-model.ts`. Den läser fasta
`sensor.polestar_*` och `binary_sensor.polestar_*` via den befintliga HA-strömmen. Bilsidan hämtar den cachen var
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

## USB-backup (installerad 2026-10-10)

`deploy/backup` innehåller installerare, systemd-mount för UUID 66CD-AEC1,
03:00-timer, arkivskript och återställningsguide. Backupen pausar de tre
applikationscontainrarna medan deras data arkiveras lokalt, återstartar dem och
verifierar arkivet på exFAT-minnet före retention (14 uppsättningar). USB-minnets
befintliga dokument lämnas kvar. Första skarpa backupen (27,6 MiB) är verifierad, båda timrarna är aktiva
och alla tre containrarna återkom efter cirka en minuts paus. Status finns i
`/var/lib/weather-station-backup/last-success.json`. Full katastrofåterställning
till nytt SD-kort är ännu inte provad.

Bilvyn har utökats med snittförbrukning, trippmätare, sammanfattad lås-/öppningsstatus,
serviceintervall och fem rapporterade hälsovarningar. Okända värden blockerar
”Allt stängt och låst”; låssensor `on` betyder olåst. Lås, hälsa och mätarställning
visar domänens egen rapporteringstid, så batteriets tid inte används för andra data.

Toppmenyn använder `NavIcon.svelte` med fem SVG-ikoner i `currentColor`.
Varje menyknapp har svensk aria-label, title och aria-current för aktiv vy.
Ikonerna är dekorativa för skärmläsare. Tryckytorna är minst 48 × 48 px och
menyn behåller temafärger/fokusmarkering. Sidrubriken visar den valda vyns namn.

## Dokumentationsspråk

Driftguiderna finns på svenska (`.md`) och engelska (`.en.md`); uppdatera båda
i samma commit. Kommandon, sökvägar och entitets-id:n ska bevaras. Dashboardens
språk ändras inte. Sparade Gemini-/Copilot-samtal behåller sitt ursprungliga språk.

Bilens temaanpassade foto och halvtransparenta lås-/hälsokort är installerade.
Paneltext har full opacitet och minst 4,5:1 kontrast vid konservativ beräkning
mot ljusaste/mörkaste möjliga bakgrund. Kontroll och bygge passerade.

## Återställt lufttryck

Lufttryck och tre timmars trycktrend visas åter i vädervyn. De fyra sekundära
mätvärdena använder två kolumner och två rader i kiosken. Saknad historik visas
som Trycktrend saknas. Väderbilderna och båda README-versionerna är uppdaterade.

Bilfotot ligger nu i fasta bakgrundslager över hela viewporten, bakom även
toppmenyn. `.dashboard.view-car` isolerar lagerordningen; `.car-view` är
genomskinlig. Vyspecifika menyunderlag skyddar läsbarheten. Mobilvyn staplar
innehållet över bakgrunden. Kontroll/bygge samt vybyte och mobilbredd verifierade.

Bilens statuskort har nu `CarStatusIcon.svelte` med tillståndsstyrda SVG-ikoner
(lås/öppet lås, service, varning, okänd status och äldre data). Kontaktfel använder
okänd ikon, rapporterade problem behåller sin varningsikon. Ikonerna är dekorativa
för skärmläsare och undantas från Ambients globala SVG-filter för att behålla
textens kontrast. Laddning och kördata har en diskret avdelare.

## Väderillustration och fläktljud · 2026-10-23

`WeatherScene.svelte` använder nu en stillbild utan CSS-animationer eller
övergångar. Bara scenens condition/daylight/sky/wind samplas: vid montering,
var tionde minut medan sidan är synlig och vid återgång till synlig sida.
Timer och lyssnare tas bort vid avmontering. Livevärden, SSE, prognoscache,
temperaturhistorik och klocka är oförändrade. Inga fläktgränser har ändrats.
Före installation: 68,1 °C, throttled=0x0, fläktsteg 3 (~7 446 rpm).
Femsekunders stickprov: Chromium 55,6 % + labwc 21,1 % av en CPU-kärna.
Check och build passerar lokalt. Användaren har installerat ändringen på Pi:n
och bekräftat att skärmen visas korrekt. Tre femsekunders stickprov efter
installationen: Chromium 0,4 / 0,4 / 5,2 % och labwc 0,2 / 0,2 / 0,0 % av en
CPU-kärna. Temperatur 64,2–65,3 °C, throttled=0x0; fläkten låg fortfarande på
steg 3 (~7 458 rpm). Ritbelastningen är kraftigt lägre; stabil temperatur och
upplevt fläktljud är ännu inte utvärderade.
