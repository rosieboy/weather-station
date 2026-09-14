# Väderstation

Svensk dashboard i SvelteKit, Svelte 5 och TypeScript för 1280 × 720.
Visar temperatur och luftfuktighet från Home Assistant: Balkong, Vardagsrum och Sovrum.
På mindre skärmar staplas rumskorten.

## Lokal utveckling

Använd Node.js 22.12 eller senare (`nvm use`).

```sh
npm ci
cp .env.example .env
# Fyll i Home Assistant-adress, token och de sex entity-ID:na i .env.
npm run dev -- --open
```

Öppna http://localhost:5173. `npm run check` kontrollerar typer,
`npm run build` bygger och `npm start` kör produktionsservern på port 3000.
`npm run format` formaterar koden.

## Home Assistant

Skapa en långlivad åtkomsttoken i din Home Assistant-profil och lägg den i
`HOME_ASSISTANT_TOKEN` i `.env`. Token ska aldrig läggas i Git eller skickas till
webbläsaren. Ange `HOME_ASSISTANT_URL` med den port där din installation svarar.
Home Assistant OS kan använda port 80; andra installationer använder ofta 8123.

Hämta sensorernas entity-ID under Utvecklarverktyg → Tillstånd och fyll i
variablerna i `.env.example`. `HA_ROOM_NAME` styr namnet på det andra området.
Servern läser [REST API](https://developers.home-assistant.io/docs/api/rest/)
och returnerar bara de utvalda mätvärdena till dashboarden.

Sidan uppdateras var 30:e sekund. Saknade värden, `unknown`, `unavailable` och
ogiltiga enheter visas som streck. Fahrenheit omvandlas till Celsius.
Anslutningsfel visas tydligt och ersätts aldrig med mockvärden.
Vid avbrott mellan webbläsaren och dashboardservern visas tidigare värden med varning.

”Mätvärde ändrat” visar den äldsta `last_updated` av de två tillgängliga
mätvärdena. En gammal tidsstämpel betyder inte säkert att sensorn är offline:
ett oförändrat värde kan vara gammalt. ”Hämtat” anger när servern försökte läsa
Home Assistant. TIMMERFLOTTE saknar lufttrycksmätning, så lufttryck visas inte.

## Docker på Mac och Raspberry Pi

Starta Docker Desktop på Macen. På Pi behövs 64-bitars Linux, Docker och Compose.
Skapa och fyll i `.env` enligt ovan. Den behövs även vid Docker-drift.

```sh
docker compose up -d --build
docker compose logs -f
# Stoppa:
docker compose down
```

Öppna http://localhost:3000. På Pi sätter du `ORIGIN` till Pi:ns adress,
t.ex. `http://weatherstation.local:3000`. Om `homeassistant.local` inte fungerar
inne i containern, använd Home Assistants IP-adress på det lokala nätverket.
Reservera gärna adressen i routern så att den inte ändras.

Compose skickar `.env` till containern vid start; hemligheter ingår inte i imagen.
Efter ändringar i `.env`, kör `docker compose up -d` för att återskapa containern.
Dockerfilen använder Node 22, stöder ARM64/AMD64 och kör som användaren `node`.
Home Assistant kör separat. Kioskstart och faktisk Raspberry Pi-drift återstår.

## Struktur

- `src/lib/server/weather.ts`: serveranslutning, sensormappning och felhantering.
- `src/lib/weather/types.ts`: datamodell med °C, procent och ISO-tidsstämplar.
- `src/routes/+page.server.ts`: sidans dataladdning.
- `src/routes/+page.svelte`: presentation och automatisk uppdatering.
- `src/app.css`: responsiv layout.

`npm audit` rapporterar tre varningar med låg allvarlighetsgrad från SvelteKits
indirekta `cookie`-beroende. Följ upp vid beroendeuppdatering; `npm audit fix --force`
föreslår här en olämplig nedgradering. Appen sätter inga egna cookies.
