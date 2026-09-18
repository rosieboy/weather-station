# Granskningsfynd

Senast granskad: 2026-09-18.

## Hög - åtkomst till dashboarden är inte autentiserad

`docker-compose.yml` publicerar port 3000 på samtliga nätverksinterface.
Kontroll-API:erna för rum och ljud jämför endast HTTP-headern `Origin` med
begärans origin. Det är ett skydd mot vanliga CSRF-anrop i webbläsare, men inte
klientautentisering: en klient på det lokala nätverket kan själv ange matchande
`Host`- och `Origin`-headers, läsa SSE-data och skicka tillåtna kommandon.

Rekommenderad åtgärd: bind porten till `127.0.0.1` om dashboarden endast körs
lokalt, eller använd autentisering via en reverse proxy innan den exponeras på
LAN.

Berörda filer:

- `docker-compose.yml`
- `src/routes/api/home/control/+server.ts`
- `src/routes/api/audio/control/+server.ts`

## Medel - ogiltig Home Assistant-token återansluter för alltid

Vid `auth_invalid` stängs WebSocket-anslutningen. Dess `onclose`-hanterare
startar sedan alltid `reconnect()`, även när tokenen är permanent ogiltig. Det
ger återkommande anslutningsförsök tills processen startas om.

Rekommenderad åtgärd: behandla autentiseringsfel som terminalt och återanslut
inte förrän applikationen har startats om med uppdaterad konfiguration.

Berörd fil: `src/lib/server/ha-stream.ts`

## Låg - kontrollendpunkterna saknar direkta tester

Testerna täcker modell- och WebSocket-logik, men inte HTTP-beteendet för
`/api/home/control`, `/api/audio/control` och SSE-endpointen. Skydd mot
felaktig origin/content type, statuskoder och resursstädning vid frånkopplade
SSE-klienter saknar regressionstester.

Rekommenderad åtgärd: lägg till fokuserade endpointtester för dessa fall.

## Att verifiera - Docker-basbildens sårbarheter

VS Codes Docker-diagnostik rapporterar 3 kritiska och 19 höga sårbarheter för
`node:22-bookworm-slim` i både bygg- och runtime-stegen. Detta behöver
bekräftas med en aktuell bildskanning och hanteras genom att uppdatera eller
byta till en verifierat säker basimage.

Berörd fil: `Dockerfile`

## Utförda kontroller

- `npm test`: 18 tester passerade.
- `npm run check`: inga fel eller varningar.
- `npm run format:check`: godkänd.
- `npm audit --omit=dev --json`: 0 produktionssårbarheter.

## Slutsats

I övrigt är grunden ovanligt genomtänkt för ett snabbt byggt projekt: token hålls server-side, entitetsvalideringen är snäv, HA-kommandon är begränsade till kända enheter, timeouts finns, och SSE-/WebSocket-livscykeln är välhanterad.
