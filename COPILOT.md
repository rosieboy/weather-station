# Granskningsfynd

Senast granskad: 2026-09-25.

## Hög - styr-API:erna saknar autentisering på LAN

`docker-compose.yml` publicerar port 3000 på samtliga nätverksinterface.
Dashboarden och dess SSE-ström behöver vara tillgängliga för andra enheter på
det lokala nätverket, så att samma vy kan visas på exempelvis iPhone, iPad och
Mac. Den avsedda läsåtkomsten är därför inte i sig ett fynd. Risken är att
kontroll-API:erna för rum och ljud endast jämför HTTP-headern `Origin` med
begärans origin. Det skyddar mot vanliga CSRF-anrop i webbläsare, men är inte
klientautentisering: en annan klient på LAN kan själv ange matchande `Host`-
och `Origin`-headers och skicka tillåtna styrkommandon.

Rekommenderad åtgärd: behåll LAN-åtkomsten för dashboard och SSE. Om det lokala
nätverket inte betraktas som betrott, skydda de muterande kontrollendpunkterna
med autentisering eller en nätverksbegränsning som inte blockerar visningsflödet.

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

- Vid granskningen 2026-09-25: `npm test` och `npm run check` passerade.
- Vid granskningen 2026-09-18: `npm run format:check` godkänd och
  `npm audit --omit=dev --json` rapporterade 0 produktionssårbarheter.

## Slutsats

I övrigt är grunden ovanligt genomtänkt för ett snabbt byggt projekt: token hålls server-side, entitetsvalideringen är snäv, HA-kommandon är begränsade till kända enheter, timeouts finns, och SSE-/WebSocket-livscykeln är välhanterad.
