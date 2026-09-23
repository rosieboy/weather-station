# Hälsokontroll på Pi:n

Förberedd systemd-oneshot och timer. Installation på Pi:n återstår tills SSH-åtkomst
är återställd. Inga mejl skickas och ingen automatisk omstart/reparation utförs.

## Installation

```bash
cd ~/weather-station
sudo bash deploy/health/install.sh
```

Installationen verifierar systemd-filerna, aktiverar timern och kör första kontrollen.
Timern kör tre minuter efter uppstart, därefter fem minuter efter avslutad kontroll.

## Vad kontrolleras?

- Rootdisken: minst 3 GiB ledigt och mindre än 85 % använt.
- Tillgängligt minne (MemAvailable): minst 300 MiB. Linux diskcache räknas inte som minnesbrist.
- CPU-temperatur: under 80 °C.
- Aktuell undervoltage/frekvensbegränsning/throttling via vcgencmd. Historiska
  flaggor sparas som information men orsakar inte permanent larm.
- Dashboard-, HA- och Matter-containrarna kör och rapporterar inte unhealthy/starting.
  Ökat omstartsantal noteras; jämförelsen återställs när containern byts eller Pi:n startas om.
- HTTP svarar på portarna 3000, 80 och 5580.
- Dashboardens SSE levererar en snapshot inom åtta sekunder utan HA-anslutningsfel.
- Ute, Balkong, Vardagsrum och Sovrum har numeriska temperatur- och fuktvärden.

Tre fel i följd för samma kontroll ger ALERT (cirka 10–15 minuter).
Fortsatt fel ger inte nya ALERT-rader. Första lyckade kontrollen ger RECOVERED.
Varje körning loggar även en kort sammanfattning. Ett etablerat fel ger exitkod 1,
vilket syns i systemd; timern fortsätter att kontrollera även efter misslyckade körningar.

Oförändrade mätvärden är inte fel. Kontrollen bevisar inte att en givare rapporterar
regelbundet om HA fortsätter visa ett gammalt giltigt värde. Lilla Roam, Samsung och
övriga enheters av/på-status kontrolleras inte. Backupålder kontrolleras ännu inte:
regelbunden extern backup måste först få en definierad destination och rutin.

## Status och loggar

```bash
systemctl list-timers weather-station-health.timer
sudo systemctl start weather-station-health.service
journalctl -u weather-station-health.service -n 30 --no-pager
sudo cat /var/lib/weather-station-health/status.json
```

Senaste mätvärden och larmräknare sparas i status.json (privat katalog).
Kontrollen använder ingen HA-token, lagrar inga entitetsvärden och gör inga externa
nätverksanrop. Den kör som root för Docker-inspektion och vcgencmd; Docker-socketen
innebär root-behörighet trots systemd-härdningen. Kör bara betrodd kod här.
Ingen watchdog eller extern tillgänglighetskontroll ingår: en strömlös Pi kan inte
köra kontrollen eller larma. Mejlleverans kan läggas till separat.

Avaktivera med `sudo systemctl disable --now weather-station-health.timer`.
Ändra gränser/containernamn i pi-health.py och kör install.sh igen.
