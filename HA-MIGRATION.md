# Home Assistant: inventering inför Pi-flytt

Historik från förberedelse till genomförd flytt 2026-09-23. Se slutstatus nedan.

## Befintlig installation

- Home Assistant på Macens virtuella maskin: Core 2026.9.3.
- Enda installerade appen/tillägget: Matter Server 9.2.0, igång.
- Matter startar automatiskt; vakthund och automatisk uppdatering är avstängda.
- Relevanta integrationer inkluderar Matter, Thread, Sonos och Apple TV.
- Pi: ARM64, 4 GiB RAM; vid inventeringen cirka 3,1 GiB tillgängligt och 48 GiB ledigt på systemdisken.

## Backup

Manuell backup `43a9f47f`, ”Inför Pi-flytt 2026-09-23 – HA och Matter”,
har laddats ned till Macen utanför Git-repot:
`/Users/andersrosen/Documents/Codex/ha-backups/2026-09-23/`.

Den innehåller HA-inställningar och historik, Matter Server 9.2.0 samt
mapparna share, ssl och media. HA betecknar arkivet som `partial`; ovanstående
innehåll har kontrollerats uttryckligen. Filstorlek: 4 556 800 byte.
Alla fem krypterade delarkiv har validerats med securetar och den sparade
återställningsnyckeln. Kontrollsumma och privata återställningsuppgifter finns
i backupmappen. Ingen provåterställning har gjorts.

Backupfiler och återställningsnycklar ska aldrig läggas i Git.

## Planen före flytten (historik)

1. Rätta VM-klockan: den låg cirka tio timmar efter vid backupen. Arkivet anger
   2026-09-22 20:44 UTC trots att arbetet återupptogs 23 september.
2. Välj en kompatibel fristående Matter Server för version 9.2.0 och verifiera
   import av dess data. Följ inte äldre Python Matter Server-guider direkt.
3. Förbered separat beständig lagring och nätverk för HA och Matter på Pi:n.
4. Ta en färsk backup vid själva bytet och stoppa Macens installation innan
   återställda kopior börjar styra samma enheter på Pi:n.
5. Verifiera enheter, grupper, automationer och dashboard innan Mac-VM:n avvecklas.

Home Assistant Container saknar tilläggshanterare. Återställning av HA-data
installerar därför inte automatiskt Matter-servern som separat container.

Källor: [Containerinstallation](https://www.home-assistant.io/installation/linux),
[Matter](https://www.home-assistant.io/integrations/matter),
[Matter-serverns generationsbyte](https://github.com/home-assistant/addons/blob/master/matter_server/MIGRATION_FAQ.md).

## Genomförd flytt 2026-09-23

HA och Matter kör nu på Pi:n. Macens HA är stoppad och får inte startas samtidigt
med Pi-kopian. Återställd backup: `5087c284` (23 september kl. 09:18), nedladdad
utanför Git och alla fem delarkiv validerade med återställningsnyckeln.

- HA: `http://vaderstation.local/` (återställd HTTP-port 80).
- Dashboard: `http://vaderstation.local:3000/`.
- Matter använder vendor ID 4939 och fabric ID 2, vilket matchar den gamla
  installationen. Utan detta väljs en tom serveridentitet.
- Matter-integrationens `use_addon` och `integration_created_addon` är false;
  adressen är `ws://127.0.0.1:5580/ws`.
- Wi-Fi-profilens IPv6-metod ändrades från ignore till auto. Netplan rapporterar
  därefter dhcp6=true. Thread-rutten lärdes in och enheterna återkom.
- Dashboardens `.env` på Pi och Mac pekar nu på `http://192.168.0.130`.
  Reservera adressen i routern. Macens lokala dashboardserver är inte igång.

Verifierat: samtliga fem lampentiteter tillgängliga, alla tre TIMMERFLOTTE ger
numeriska temperaturvärden, Sonos Kök/Balkong/TV-rum och Apple TV svarar,
Pi-dashboardens SSE-flöde har error=null. Lilla Roam och Samsung rapporterades
fortfarande otillgängliga. Vid denna kontroll återstod fysiska kontrollkommandon och omstartstest; se uppföljning nedan.
HA loggar även en Bluetooth-behörighetsvarning; lokal Bluetooth är inte konfigurerad.

## Slutstatus 2026-09-23

Användaren bekräftade fungerande visning efter flytten. Lilla Roam är avstängd
(enligt användaren), och Samsung lämnas utanför fortsatt felsökning.
Den separata utomhusgivaren använder `sensor.utetemperatur_temperatur` och
`sensor.utetemperatur_luftfuktighet` för huvudvärdet. Balkongkortet använder
riktiga TIMMERFLOTTE-värden; tidigare mockvärden är borttagna. Källmappning och
WebSocket-prenumeration är uppdaterade, byggda och verifierade i Pi:ns liveflöde.

Mac-VM:ns klocka verifierades efter omstart till cirka 0,35 sekunders avvikelse.
Den senare backupen 5087c284 har korrekt datum/tid. Säkerhetskopior och privata
återställningsuppgifter ligger utanför repot. Omstartstest efter hela flytten är nu bekräftat fungerande av användaren.
Regelbunden extern backup och provåterställning återstår.

Uppföljning: användaren rapporterar drygt fyra timmars stabil drift samt att
minnesanvändning, temperatur och diskutrymme ser bra ut i egen diagnostik.

## Kompletterad givarinventering

Utomhusgivarens modell har bekräftats av användaren: **Shelly BLU H&T ZB**
(tillverkarens stavning Shelly). Den är ansluten via DIRIGERA och används som
huvudvärde i vädervyn. README innehåller nu en detaljerad bild av Pi-arkitekturen
samt bevarade tidigare översikter.
