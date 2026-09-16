# Väderstation

Svensk dashboard för temperatur och luftfuktighet, byggd med SvelteKit, Svelte 5
och TypeScript. Layouten är anpassad till 1280 × 720 och staplar rumskorten på
mindre skärmar. Balkong visas som huvudvärde, med Vardagsrum och Sovrum under.

![Bild på prototyp](./static/screenshot2.png 'Tidig prototyp')

Dokumentationen beskriver implementationen och den verifierade Mac-installationen
per **2026-09-14**. Raspberry Pi-drift är planerad och ännu inte verifierad.

## Status och genomförda val

- Projektet började med mockdata för ute, vardagsrum, sovrum och kontor.
  Nu hämtas riktiga värden från tre TIMMERFLOTTE-sensorer via Home Assistant.
- Slutliga områden är **Balkong, Vardagsrum och Sovrum**. Den givare som först
  kallades Kök används som Vardagsrum, enligt bekräftad mappning i Home Assistant.
- Lufttryck har tagits bort eftersom våra givare bara tillhandahåller temperatur
  och luftfuktighet. Landskapsbilden är dekorativ. En separat prognosrad visar vädret från met.no.
- Dashboarden kör i Docker Desktop. Home Assistant OS kör separat i VirtualBox.
  Det ursprungliga förslaget att även köra Home Assistant i Docker ersattes av
  Home Assistant OS för installationen med Matter.
- Sensorflödet använder WebSocket och SSE sedan 2026-09-14. Ingen databas eller historiklagring finns. Prognoser cachas i 15 minuter på servern; sensorvärden uppdateras via händelser.
- Mockleverantören är borttagen. Typen `source` och visningen har kvar stöd för
  etiketten `mock`, men ingen konfigurationsinställning aktiverar ett demoläge.

## Visualisering

![Visualisering av väderpresentation](./static/visualisering.png 'Visualisering av väderpresentation')

## Arkitektur

```mermaid
flowchart LR
    Sensors["3 × TIMMERFLOTTE"] -->|"Matter över Thread"| HA["Home Assistant OS\nVirtualBox på Mac"]
    HA -->|"WebSocket: tillstånd + REST: prognos"| Server["SvelteKit-server\nDocker Desktop, port 3000"]
    Server -->|"SSE: utvalda mätvärden"| Browser["Dashboard i webbläsaren"]
```

Thread-trafiken passerar hemmets Thread-gränsrouter. DIRIGERA och Apple TV finns
i installationen; exakt vilken gränsrouter som bär respektive sensors trafik har
inte verifierats. Alla tre sensorer är enligt användaren anslutna till Apple Hem
och har därefter lagts till i Home Assistant. Dashboarden kommunicerar endast med
Home Assistant, aldrig direkt med Apple Hem, DIRIGERA eller sensorerna.

### Server och webbläsare

1. En gemensam anslutning per serverprocess öppnas mot Home Assistants
   `/api/websocket` och autentiseras med token på servern.
2. Servern prenumererar på `state_changed` och läser därefter `get_states`.
   Händelser under inläsningen buffras. Bara konfigurerade sensorer, väder, sol
   och måne lagras i minnet; borttagna entiteter tas bort ur cachen.
3. `+page.server.ts` ger sidan ett första läge. Vid kallstart kan anslutningen
   fortfarande pågå; nästa strömmade uppdatering fyller i värdena.
4. Webbläsaren öppnar `EventSource('/api/events')`. Server-Sent Events (SSE)
   skickar normaliserad siddata när relevanta tillstånd ändras. Token och andra
   Home Assistant-entiteter skickas inte till webbläsaren.
5. WebSocket kontrolleras med ping/pong var 20:e sekund. Uteblivet svar leder
   till återanslutning. Uppstart har 10 sekunders timeout; återförsök använder
   ökande väntetid från 1 till 30 sekunder och läser om hela startläget.
6. Vid avbrott behålls senast mottagna värden med varning. Felaktig token ger
   ett särskilt meddelande. Webbläsaren återansluter SSE automatiskt, med 3 sekunders
   angiven väntetid. SSE skickar även en livssignal var 15:e sekund.

Sensorerna REST-pollas inte längre. Prognoser hämtas fortsatt med REST och
15 minuters cache. En timer för varje öppen SSE-ström uppdaterar prognosvyn var
15:e minut även om sensorerna inte ändras. Stängda flikar städar upp prenumerationer
och timers. Home Assistant-anslutningen hålls kvar tills serverprocessen stoppas;
under lokal utveckling stängs den också vid modulbyte.

## Teknik och projektstruktur

| Del               | Val                                                              |
| ----------------- | ---------------------------------------------------------------- |
| Webbapp           | SvelteKit 2, Svelte 5, TypeScript 5                              |
| Byggverktyg       | Vite 8 och Svelte-plugin 7                                       |
| Produktionsserver | `@sveltejs/adapter-node` 5                                       |
| Node              | Node 22 i `.nvmrc` och Docker; `package.json` kräver minst 22.12 |
| Pakethantering    | npm; exakta installerade versioner finns i `package-lock.json`   |
| Formatering       | Prettier med Svelte-plugin                                       |
| Utseende          | Egen CSS, systemtypsnitt och inline-SVG; inget UI-bibliotek      |

```text
src/
├── app.html                       # Svenskt HTML-dokument
├── app.css                        # Layout och responsiva brytpunkter
├── lib/
│   ├── server/weather.ts          # API-anrop, mappning och felhantering
│   └── weather/types.ts           # SensorReading och WeatherSnapshot
└── routes/
    ├── +layout.svelte             # Gemensam CSS
    ├── +page.server.ts            # Serverns dataladdning
    └── +page.svelte               # Presentation och uppdateringstimer
Dockerfile
docker-compose.yml
.env.example
```

### Datamodell och felbeteende

`SensorReading` innehåller `id`, `name`, `temperature`, `humidity` och `updatedAt`.
`WeatherSnapshot` innehåller `source`, `outdoor`, `rooms`, `fetchedAt` och `error`.

- Temperatur anges i °C; °F konverteras. Andra temperaturenheter avvisas.
- Luftfuktighet måste anges i % och ligga mellan 0 och 100.
- Saknade entiteter, tomma värden, `unknown`, `unavailable` och ogiltiga tal eller
  enheter ger `null`, vilket visas som ett streck. Övriga givare visas fortfarande.
- Saknad adress/token ger meddelandet att Home Assistant inte är konfigurerad.
- Avbrott mot Home Assistant visas med varning; senast mottagna sensorvärden
  behålls tills anslutningen har återställts och ett nytt startläge lästs in.
- Saknad adress/token och nekad autentisering ger tydliga meddelanden.
- Vid avbrott mellan webbläsare och server behålls siddata med en separat varning.

”Mätvärde ändrat” visar den äldsta giltiga `last_updated` av platsens tillgängliga
mätvärden. Det är inte ett bevis på senaste radiokontakt; ett oförändrat värde kan
ha en gammal tidsstämpel. Ingen automatisk åldersgräns för gamla värden finns ännu.
”Hämtat” anger när servern sammanställde siddata, inte sensorns rapporttid.
Tider visas i `Europe/Stockholm`, temperatur med en decimal och luftfuktighet
avrundad till heltal.

## Nuvarande Home Assistant-installation

- MacBook Pro med M3 Pro och 18 GB RAM.
- VirtualBox 7.2.16 med Home Assistant OS 18.2, ARM64-VDI.
- Virtuell maskin: 4096 MB RAM, 2 processorer, EFI och VirtioSCSI.
- Nätverk: Bridged Adapter via Macens Wi-Fi (`en0`).
- Home Assistant nås på **http://homeassistant.local**, port **80**.
  Port 8123 i det första `.env`-exemplet fungerade inte i denna installation.
- Vid första starten fanns både en tom VirtualBox-disk och HAOS-disken anslutna.
  Felsökningen omfattade att ta bort den tomma diskanslutningen och använda
  HAOS-disken på port 0. Installationen bekräftades därefter fungera; den exakta
  orsaken till de tidigare swap-felen fastställdes inte.

VirtualBox-inställningar, HAOS-disk, sensorkopplingar, Home Assistant-konto och
Home Assistant-backuper ingår inte i detta repo. De behöver hanteras separat.
Docker Compose startar endast dashboarden. På Mac behöver även Home Assistant-VM:n
vara igång och datorn vaken för kontinuerlig drift.

Referenser: [Home Assistant på Mac](https://www.home-assistant.io/installation/macos/),
[Matter](https://www.home-assistant.io/integrations/matter/),
[REST API](https://developers.home-assistant.io/docs/api/rest/).

## Konfiguration

Skapa `.env` från `.env.example` endast första gången. Exempelfilen innehåller
platshållare; redigera sedan **`.env`** med rätt värden.

| Variabel                 | Betydelse / aktuell konfiguration                                  |
| ------------------------ | ------------------------------------------------------------------ |
| `ORIGIN`                 | Dashboardens externa adress: `http://localhost:3000`               |
| `HOME_ASSISTANT_URL`     | Home Assistants basadress: `http://homeassistant.local`            |
| `HOME_ASSISTANT_TOKEN`   | Långlivad åtkomsttoken från Home Assistant-profilen; endast lokalt |
| `HA_BALCONY_TEMPERATURE` | Balkongens temperatur-entitet                                      |
| `HA_BALCONY_HUMIDITY`    | Balkongens fukt-entitet                                            |
| `HA_ROOM_NAME`           | `Vardagsrum`; standardvärdet i koden är också Vardagsrum           |
| `HA_ROOM_TEMPERATURE`    | Vardagsrummets temperatur-entitet                                  |
| `HA_ROOM_HUMIDITY`       | Vardagsrummets fukt-entitet                                        |
| `HA_BEDROOM_TEMPERATURE` | Sovrummets temperatur-entitet                                      |
| `HA_BEDROOM_HUMIDITY`    | Sovrummets fukt-entitet                                            |

Bekräftad sensormappning 2026-09-14:

| Plats      | Temperatur                                          | Luftfuktighet                                    |
| ---------- | --------------------------------------------------- | ------------------------------------------------ |
| Balkong    | `sensor.timmerflotte_temp_hmd_sensor_temperature`   | `sensor.timmerflotte_temp_hmd_sensor_humidity`   |
| Vardagsrum | `sensor.timmerflotte_temp_hmd_sensor_temperature_3` | `sensor.timmerflotte_temp_hmd_sensor_humidity_3` |
| Sovrum     | `sensor.timmerflotte_temp_hmd_sensor_temperature_2` | `sensor.timmerflotte_temp_hmd_sensor_humidity_2` |

Entity-ID:n kan ändras vid omparkoppling eller namnbyte. Kontrollera dem under
Home Assistants Utvecklarverktyg → Tillstånd. Suffixen är inte rumsnamn; mappningen
ovan verifierades mot områdena i Home Assistant.

`.env` ignoreras av Git och utesluts från Docker-byggkontexten. Compose läser in
filen som runtime-miljövariabler. Servern läser token privat; den ska inte läggas i
`PUBLIC_`-variabler, README eller klientkod. Nuvarande trafik använder HTTP på det
lokala nätverket. Dashboarden har ingen egen inloggning och Compose publicerar port
3000 på värddatorns nätverksgränssnitt. Ingen internetpublicering är konfigurerad.

## Lokal utveckling

```sh
git clone https://github.com/rosieboy/weather-station.git
cd weather-station
nvm use
npm ci
cp .env.example .env # Endast om .env inte redan finns!
# Fyll i .env enligt tabellerna ovan.
npm run dev -- --open
```

Öppna http://localhost:5173. Utvecklingsservern kan köras samtidigt som Docker-appen
på port 3000. Kodändringar syns direkt i utvecklingsläget, men kräver ombygge i Docker.

| Kommando               | Funktion                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `npm run check`        | Svelte- och TypeScript-kontroll                             |
| `npm run build`        | Bygger produktionsservern till `build/`                     |
| `npm start`            | Kör bygget och läser `.env` om den finns; normalt port 3000 |
| `npm run preview`      | Förhandsvisar bygget via Vite                               |
| `npm run format`       | Formaterar projektet                                        |
| `npm run format:check` | Kontrollerar formateringen                                  |

Stoppa Docker-appen före `npm start`, eller välj en annan port, exempelvis
`PORT=3001 ORIGIN=http://localhost:3001 npm start`.

## Docker-drift

```sh
docker compose up -d --build # Bygg och starta efter kodändringar
docker compose ps           # Kontrollera status
docker compose logs -f      # Följ loggar; Ctrl+C stoppar bara loggvisningen
docker compose down         # Stoppa och ta bort dashboardcontainern
```

Öppna http://localhost:3000. Efter ändring i `.env`, kör `docker compose up -d`
för att applicera konfigurationen; en vanlig omstart läser inte in en ändrad fil.

Dockerfilen bygger med `node:22-bookworm-slim`, installerar med `npm ci`, kör
kontroll och bygge, och kopierar endast `build/` och `package.json` till runtime-steget.
Alla nuvarande appberoenden bundlas. Om externa produktionsberoenden tillkommer måste
runtime-steget även installera dem. Basimagen är en rörlig Node 22-tagg, inte låst
med digest. Bygget använder värdmaskinens arkitektur; basimagen finns för ARM64/AMD64.

Containern kör som användaren `node`, lyssnar på `0.0.0.0:3000` och har
`init: true` samt `restart: unless-stopped`. Ingen hälsokontroll eller datavolym
finns. Dashboarden sparar ingen egen historik. Att stoppa den påverkar inte Home
Assistant-VM:n eller sensorkopplingarna.

Om `.local` inte kan lösas inne i Docker, sätt `HOME_ASSISTANT_URL` till Home
Assistants LAN-IP och reservera gärna adressen i routern. Använd inte `localhost`
som Home Assistant-adress inne i dashboardcontainern: det pekar på containern själv.

## Verifierat och återstående

Genomförda kontroller vid integrationsarbetet 2026-09-14:

- Svelte-/TypeScript-kontroll och produktionsbygge, även inne i Docker.
- Startad container och verkliga mätvärden för alla tre områden i webbläsaren.
- Kontroll att token inte fanns i dashboardens HTML-svar.
- Separata körda kontroller av Fahrenheit-konvertering, saknade/otillgängliga
  givare, HTTP 401 och nätverksfel. Dessa var engångskontroller; dessa kompletteras nu av `npm test` för WebSocket-transporten. CI är inte konfigurerat.

Vid beroendekontrollen 2026-09-13 rapporterade `npm audit` tre varningar med låg
allvarlighetsgrad från SvelteKits indirekta `cookie`-beroende. Det är en daterad
kontroll, inte en aktuell säkerhetsgaranti. Appen sätter inga egna cookies.
`npm audit fix --force` föreslog då en olämplig nedgradering.

Återstår inför apparaten:

- Välj driftupplägg på Raspberry Pi: dashboardens Linux/Docker-installation och
  Home Assistant OS-installationen är separata upplägg och behöver planeras ihop.
  Dagens Compose-fil installerar inte Home Assistant.
- Verifiera bygge och drift på fysisk Pi, skärmrotation och faktisk skärmupplösning.
- Konfigurera kioskstart och återstart efter strömavbrott.
- Planera Home Assistant-backup/flytt och kontrollera entity-ID:n efter migrering.
- Vid behov: utökad testsvit, historik och bättre indikering av
  sensorernas tillgänglighet. Dessa funktioner finns inte i nuvarande version.

## Prognos, jämförelsetemperatur och astronomi (2026-09-14)

Den egna utomhussensorn är fortfarande huvudvärdet. met.no visas mindre bredvid,
märkt **beräknad temperatur**, eftersom värdet inte är vår lokala mätning.
Vid byte till Eve ändras `HA_BALCONY_TEMPERATURE` och `HA_BALCONY_HUMIDITY` till
Eve-enheternas entity-ID:n; den egna sensorn behåller huvudrollen.

- `HA_WEATHER_ENTITY=weather.forecast_hem` väljer den befintliga met.no-entiteten.
- `HA_MOON_ENTITY=sensor.moon_fas` väljer Moon-sensorn. Home Assistants lokala
  Moon-integration lades till vid detta arbete.
- Nästa soluppgång och solnedgång hämtas från `sun.sun`, med datum så att morgondagens
  uppgång inte förväxlas med dagens. Tidszonen är fortsatt Europe/Stockholm.
- Sex prognoskolumner visar dygn (max/min) eller timmar. Två touchvänliga knappar
  växlar läge. Nederbörd visas som sannolikhet i procent, inte mängd.
- Prognosen hämtas via `POST /api/services/weather/get_forecasts?return_response`
  för `daily` och `hourly`. Detta är en datahämtande Home Assistant-action.
- Lyckade prognossvar cachas i 15 minuter i serverprocessens minne. Cachen försvinner
  vid omstart. Misslyckade prognoser visas som otillgängliga och provas igen vid
  nästa siduppdatering. Sensorvärden fungerar även om prognoshämtningen misslyckas.
- `src/lib/server/forecast.ts` normaliserar prognoser och hanterar cache;
  `src/lib/weather/labels.ts` innehåller svenska väder- och månfasnamn.

Dashboarden anropar bara Home Assistant. met.no-integrationen sköter externa
väderanrop och platskonfiguration. Källan anges i sidfoten. Inga koordinater eller
åtkomsttoken skickas till klienten av den nya funktionen. Ingen exakt Eve-modell
eller dess entity-ID:n är konfigurerade ännu.

### Verifiering av direktuppdatering

`npm test` testar en delad transport, händelser under startinläsning, filtrering,
borttagna entiteter, återanslutning med nytt startläge och autentiseringsfel med
simulerad WebSocket. `src/lib/server/ha-stream.ts` hanterar transporten och
`src/routes/api/events/+server.ts` hanterar SSE och klienternas städning.
Ingen ny miljövariabel krävs. Node 22:s inbyggda WebSocket används.

Vid framtida reverse proxy måste `/api/events` kunna strömmas utan buffring och
utan kort timeout. Endpointen skickar `X-Accel-Buffering: no` och cacheförbud.
En flerprocessinstallation får en Home Assistant-anslutning per process;
nuvarande Docker-installation kör en process.

## Dag- och nattläge samt kompletterande väderdata

Knappen i sidhuvudet växlar Auto → Natt → Dag. Valet sparas lokalt i webbläsaren.
Auto använder solhändelserna i `sun.sun` (se detaljer nedan), med solstatus som reserv.
Saknas solstatus används dagläge. Vid anslutningsavbrott behålls senast mottagna
solstatus tills anslutningen återkommer. Nattläget har mörk bakgrund och varma,
dämpade rödtoner; det ändrar färgerna, inte skärmens hårdvaruljusstyrka.

met.no-panelen visar även lufttryck i hPa, vind i m/s och kompassriktning (varifrån
vinden blåser). Kända enheter konverteras; saknade/okända enheter visas som streck.
Tiden ”Värde ändrat” kommer från väderentitetens `last_updated`, inte från
prognosmodellens körtid eller en garanterad tid för senaste hämtning.

Stora panelen heter nu Utetemperatur men använder fortfarande den riktiga
balkongsensorn. Raden Hemma innehåller Vardagsrum, Sovrum och Balkong.
Balkong i denna rad är uttryckligen märkt Mockdata: fasta 18,4 °C och 62 %,
utan uppdateringstid. Byt ut detta exempel när en separat utomhussensor finns.

### Solstyrning, klocka, trycktrend och väderbild (2026-09-16)

Auto följer i första hand `sun.sun.attributes.next_rising` och `next_setting`,
inte enbart `sun.sun.state`. Alla jämförelser använder absoluta UTC-tidpunkter;
klockan och solhändelserna formateras i Europe/Stockholm med automatisk sommartid.
Skärmens klocka synkroniseras mot serverns `fetchedAt` vid varje SSE-meddelande och
räknar vidare varje sekund. Växlingen sker vid solhändelsen, utan förskjutning,
även om just det WebSocket-meddelandet dröjer. Saknas en användbar tidplan används
solstatusen som reserv, och saknas även den används dagläge. En helt utgången
plan extrapoleras inte till nästa dygn. Manuell färginställning påverkar inte
landskapets faktiska dag/natt.

Vid kontroll 16 september stämde Mac, Docker och Home Assistants klockor överens;
HA:s tidszon var Europe/Stockholm. `sun.sun` rapporterade fortfarande
`last_changed` från 14 september och `below_horizon`, trots uppdaterade solattribut.
Det är en konstaterad avvikelse i solstatusen; orsaken till att den fastnat är
inte fastställd. Den kan förklara tidigt nattläge i den tidigare implementationen.

Trycktrenden hämtar Recorder-historik för samma met.no-entitet tre timmar före
det aktuella vädervärdets `last_updated`. Resultatet är hPa-differensen: mer än
+0,5 stigande, mindre än −0,5 fallande, annars stabilt. Historiksvaret cachelagras
15 minuter per aktuellt värde, samtidiga anrop samordnas. Det kräver historik med
tryckattribut i HA; saknad historik, API-fel eller ett aktuellt värde äldre än
90 minuter ger ”Trycktrend saknas”. Inget separat datalager behövs på dashboarden.
Trenden beskriver met.no-värden, inte en lokal barometer eller en vädervarning.

`WeatherScene.svelte` är stilla SVG med samma landskap och färgpalett som tidigare.
Den visar sol/måne, stjärnor, moln, regn, snö/hagel, dimma, vind och åska efter
met.no:s väderkod samt soltid. Månformen är en stiliserad tolkning av månfasen,
inte en astronomiskt exakt återgivning. Okänt väder visar en neutral miljö.
Grafiken ändras bara när dess indata ändras, utan animation eller egna nätanrop.
Befintlig 15-minutersuppdatering och livehändelser används; solväxlingen väntar
inte på nästa 15-minutersintervall.
