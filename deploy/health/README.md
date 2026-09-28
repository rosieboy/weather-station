# Hälsokontroll på Pi:n

Installerad och verifierad på Pi:n 2026-09-23. Timern är aktiverad och första
körningen slutfördes 20:55 CEST med alla 11 kontroller godkända. Mejl är valfritt och kräver separat aktivering nedan. Ingen automatisk omstart/reparation utförs.

## Installation

```bash
cd ~/weather-station
sudo bash deploy/health/install.sh
```

Installationen verifierar systemd-filerna, aktiverar timern och kör första kontrollen.
Ett aktivt larm sparas och skickas som vanligt, men gör inte systemd-tjänsten
misslyckad. Ett faktiskt körfel stoppar installationen och syns i journalen.
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
- Enhetshälsan från dashboardens `/api/device-health`: Matter-lampor och
  uttag som varit utan kontakt minst 15 minuter samt batterier vid högst
  30 % (varning) och 15 % (kritiskt). De här två kontrollerna larmar vid
  första femminuterskörningen efter att gränsen passerats. Ett batteri som
  återhämtat sig över 30 % ger RECOVERED; övergång från lågt till kritiskt
  ger ett nytt ALERT.

Tre fel i följd för samma kontroll ger ALERT (cirka 10–15 minuter).
Fortsatt fel ger inte nya ALERT-rader. Första lyckade kontrollen ger RECOVERED.
Varje körning loggar även en kort sammanfattning. Etablerade larm ger exitkod 0
eftersom själva kontrollen har slutförts; de syns i statusfilen, journalen och mejl.
Oväntade skriptfel ger fortfarande en misslyckad systemd-tjänst. Timern fortsätter
att köra vid nästa intervall.

Oförändrade mätvärden är inte fel. Kontrollen bevisar inte att en givare rapporterar
regelbundet om HA fortsätter visa ett gammalt giltigt värde. Lilla Roam, Samsung och
övriga enheters av/på-status kontrolleras inte. Backupålder kontrolleras ännu inte:
regelbunden extern backup måste först få en definierad destination och rutin.

Enhetshändelser visas i Rum-vyn och sparas i dashboardens Docker-volym
`device-health-data` i 90 dagar. Home Assistants Recorder används för att
återskapa missade händelser efter ett ombygge av appcontainern. Om Pi och HA
är avstängda längre än Recorder-historiken behåller (normalt tio dagar) kan
den mellanliggande perioden inte rekonstrueras. `device_monitor`-kontrollen
rapporterar också om själva historikfrågan misslyckas.

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
köra kontrollen eller larma. Mejlleverans är nu aktiverad enligt avsnittet nedan.

Avaktivera med `sudo systemctl disable --now weather-station-health.timer`.
Ändra gränser/containernamn i pi-health.py och kör install.sh igen.

## Gmail-utskick (aktiverat 2026-09-24)

SMTP-stöd finns nu, med avsändare redaretorget@gmail.com och mottagare
androsen@gmail.com. Aktivering och faktisk leverans är verifierade 2026-09-24 kl. 20:53 CEST.
Vid ominstallation: kör install.sh med sudo och sedan
`sudo python3 deploy/health/configure-mail.py` från repots rot på Pi:n.
Applösenordet anges dolt och lagras i `/etc/weather-station-health/smtp.json`
med rättighet 0600. Det får aldrig läggas i Git eller skickas i chatten.

Första körningen efter konfigurering skickar ett startmeddelande. Nya ALERT och
RECOVERED sparas i statusfilens utkorg före sändning, samlas i ett mejl per körning
via smtp.gmail.com:587 med verifierad STARTTLS, och tas bort ur kön efter lyckad
sändning. Misslyckad sändning provas igen vid nästa kontroll. En krasch precis
mellan sändning och sparande kan ge ett dubbelt mejl. Inga gamla journalhändelser
skickas retroaktivt. Utan SMTP-konfiguration fortsätter lokal övervakning som förut.
Mejlen har HTML-layout med tydliga larm- och återhämtningsrader samt en vanlig
textversion för klienter som inte visar HTML. Tid anges i Europe/Stockholm.

```bash
sudo bash deploy/health/install.sh
sudo python3 deploy/health/configure-mail.py
sudo systemctl start weather-station-health.service
journalctl -u weather-station-health.service -n 10 --no-pager
```

Retry/TLS-test har körts med simulerad SMTP. Verklig Gmail-leverans är verifierad: användaren tog emot READY-mejlet,
journalen visar Mail delivered, kön är tom och timern är aktiv. Ingen permanent SMTP-process eller ny container behövs.
