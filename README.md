# Väderstation

En enkel dashboard för hemma, byggd med SvelteKit, Svelte 5 och TypeScript.
Första versionen visar **mockdata**, utan externa tjänster eller anslutna sensorer.
Layouten är anpassad för **1280 × 720** och staplar rumskorten på mindre skärmar.

## Lokal utveckling på Mac

Använd Node.js 22 (minst 22.12) och npm. Med nvm: `nvm use`.

```sh
git clone https://github.com/rosieboy/weather-station.git
cd weather-station
npm ci
cp .env.example .env
npm run dev -- --open
```

Öppna http://localhost:5173. Använd webbläsarens responsiva utvecklingsvy med
1280 × 720 för att simulera skärmen. Ingen Home Assistant eller Docker behövs.

```sh
npm run check   # TypeScript och Svelte
npm run build   # Bygg produktionsservern
npm start       # http://localhost:3000, läser .env om filen finns
```

## Struktur och data

- `src/lib/weather/types.ts`: gemensam datamodell; °C, relativ luftfuktighet i % och hPa.
- `src/lib/server/weather.ts`: datakällan, nu fasta exempelvärden.
- `src/routes/+page.server.ts`: hämtar data på servern till sidan.
- `src/routes/+page.svelte`: dashboarden.
- `src/app.css`: layout och utseende, utan UI-bibliotek eller externa typsnitt.

| Plats      | Temperatur | Luftfuktighet | Lufttryck |
| ---------- | ---------- | ------------- | --------- |
| Ute        | 8,4 °C     | 81 %          | 1012 hPa  |
| Vardagsrum | 21,6 °C    | 43 %          | –         |
| Sovrum     | 19,8 °C    | 48 %          | –         |
| Kontor     | 21,2 °C    | 41 %          | –         |

`null` betyder att ett mätvärde saknas och visas som ett streck. `updatedAt`
är avsett för sensorns ISO-tidsstämpel och är `null` för mockdata.
Sidan hämtar data vid sidladdning; automatisk uppdatering är ännu inte implementerad.

## Docker och planerad Raspberry Pi-installation

Starta Docker Desktop för att prova på Macen. På Pi:n är målet ett 64-bitars
operativsystem med Docker Engine och Compose-plugin installerade.

```sh
cp .env.example .env # endast första gången, behåll befintliga inställningar
# Sätt ORIGIN i .env till adressen du använder, t.ex. http://weatherstation.local:3000
docker compose up -d --build
docker compose logs -f
# Stoppa:
docker compose down
```

Öppna http://localhost:3000 på Macen, eller http://weatherstation.local:3000 om
Pi:n har det värdnamnet. Port 3000 exponeras på värddatorn.
Compose läser `ORIGIN` från `.env` och skickar den till servern.

Dockerfilen bygger med SvelteKits [Node-adapter](https://svelte.dev/docs/kit/adapter-node)
och kör resultatet som användaren `node`. Node-imagen stöder ARM64 och AMD64;
bygget använder värdmaskinens arkitektur. Inga produktionsberoenden behövs i
nuvarande version eftersom appens beroenden bundlas. Om sådana läggs till senare
behöver även runtime-steget installera dem.

Raspberry Pi och själva containerbygget behöver verifieras på en körande Docker-miljö.
Automatisk omstart är konfigurerad. Kioskstart av webbläsaren och Home Assistant
ingår inte i Compose ännu.

## Planerad Home Assistant-integration

1. Anslut sensorerna till Home Assistant och identifiera deras entity-ID:n.
2. Ersätt mockleverantören i `src/lib/server/weather.ts` med anrop till
   Home Assistants [REST API](https://developers.home-assistant.io/docs/api/rest/).
   Behåll samma `WeatherSnapshot` så att dashboarden inte behöver känna till sensormärken.
3. Läs `HOME_ASSISTANT_URL` och `HOME_ASSISTANT_TOKEN` via SvelteKits
   `$env/dynamic/private`. Variablerna i `.env.example` är endast platshållare och
   används inte ännu. Vid Docker-drift behöver de också skickas in i Compose.
   Token ska stanna på servern och får aldrig returneras till webbläsaren eller committas.
4. Mappa temperatur, luftfuktighet och lufttryck; normalisera enheter och omvandla
   `unknown`/`unavailable` till `null`. Bevara `last_updated` som `updatedAt`.
5. Lägg till timeout, hantering av avbrott och indikering av gamla mätvärden.
   Börja med periodisk uppdatering och använd vid behov
   [WebSocket API](https://developers.home-assistant.io/docs/api/websocket/) senare.

Home Assistant körs separat. Apple Home-, DIRIGERA- och sensoranslutningar blir
nästa etapp; den här versionen gör inga anrop till dem.

## Verifiering av projektgrunden

Typkontroll, produktionsbygge, kodformatering och Compose-konfiguration är
kontrollerade. Dashboarden är även granskad i webbläsaren vid 1280 × 720.
Docker Desktop var inte startat vid kontrollen, så containerbygge och Pi-drift
återstår att testa.

`npm audit` rapporterar tre varningar med låg allvarlighetsgrad som härrör från
SvelteKits indirekta `cookie`-beroende. Appen sätter inga egna cookies.
Följ upp detta vid nästa beroendeuppdatering; undvik `npm audit fix --force`,
som här föreslår nedgradering till äldre SvelteKit-versioner.
