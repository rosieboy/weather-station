# UI-redesign för hemmaskärmen

Detta är den aktiva design- och överlämningsfilen för nästa UI-pass. På denna branch ska vi bara förenkla och försköna presentationen – inte ändra funktionalitet.

## Mål

- Minimal, premium och "slick" design utan AI-känsla
- Mera avskalad presentation i både dag- och nattläge
- Minskat brus: färre textblock, tydligare hierarki, mindre extrainfo
- Vassare dagläge och varmare, mer lugn nattkänsla
- Ingen ny funktionalitet, inga backendändringar

## Designprinciper

1. Håll appen "hemma" och inte "smart-home-verktyg"
2. Temperatur, status och detta rum är det viktigaste
3. Ta bort små metadata-lappar och redundanta textfält
4. Bygg en konsekvent kortlayout för alla vyer
5. Dagläge: ljus, varm och skarp
6. Nattläge: mörk, varm, röd/brun och mer avkopplande
7. Rörelsetänkande och gradienter ska vara väldigt subtila

## Kort för Codex

> Vi är i en UI-only redesign-branch. Målet är att förenkla hemmaskärmen och göra den mer premium, minimal och konsistent utan att ändra logik eller funktionalitet.
>
> Fokusera på: mindre brus, tydligare hierarki, avskalad layout, bättre dag/nattpalett, storleksjusteringar, enklare kort, lägre textmängd, mer ren typografi, bättre spårning mellan vyer.
>
> Gör INTE: inga nya API:er, inga Home Assistant-flöden, inga användarflöden, inga scenes, inga backendändringar, inga funktionella kommandon.
>
> Behåll all existerande data och interaktion, men omformulera presentationen för att få en mer "slick" och lugn hemmaskärmskänsla.

## Visual design

### Dagläge

- Varm off-white / grå-beige bas
- Mörkt mossgrönt eller grafit för accent
- Klar kontrast, men inte hård
- Tydliga siffror, lugn spacing, minimal inredning

### Nattläge

- Mycket mörk bas med varm kol/grå ton
- Terrakotta / varm rödbrun / amber accent
- Mer dämpad och avslappnad känsla
- Undvik neon, starkt rött eller kallt blått

## Prioritering

1. Första passet: layout, kort, typografi, färg
2. Andra passet: småvisuella förbättringar och konsistens
3. Ingen funktionell expansion under denna branch

## Accepterat resultat

- Vyn ska kännas ren, premium och hemkärleksfull
- Korten ska vara stilistiskt enhetliga
- Appen ska visa tydligare status utan att verka “AI” eller alltför gadgetig
- Nattläge och dagläge ska kännas som två distinkta men konsekventa versioner av samma designsystem

## Implementation notes

- Håll CSS i app.css och komponenternas markup så nära nuvarande struktur som möjligt
- Försök hålla samma domstruktur och interaktioner, men justera styling för mer avskalad visualitet
- Tänk i komponenter: header, hero, kort, paneler, knapp/segmentation, statusbar
- Arbeta iterativt: få den övergripande stilen riktig först, sedan finjustera detaljer
