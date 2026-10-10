# Manuell drift av väderstationen

Svenska · [English](DRIFT.en.md)

Kontrollerad mot installationen **2026-10-10**. Pi-användaren är `anders`,
värdnamnet `vaderstation.local`. Dashboarden körs i `~/weather-station`,
Home Assistant och Matter Server i `~/home-assistant`.

- Dashboard: <http://vaderstation.local:3000/>
- Home Assistant: <http://vaderstation.local/>

## Logga in från Macen

Kör i **Macens Terminal**:

```sh
ssh -t -i ~/.ssh/id_raspberry anders@vaderstation.local
```

Efter inloggning körs resterande kommandon **på Pi:n**, om inget annat anges.
`sudo` frågar efter Pi-användarens lösenord. Inga lösenord eller API-nycklar
ska klistras in i Git eller driftloggen.

## Uppdatera efter en ändring i GitHub

På Pi:n:

```sh
cd ~/weather-station
git status --short
git pull --ff-only
sudo docker compose up -d --build
sudo docker compose ps
curl --fail --silent http://localhost:3000/ >/dev/null && echo 'Dashboarden svarar'
python3 scripts/pi/restart-kiosk.py
```

`git status --short` är tom när repot saknar lokala ändringar. Om pull misslyckas,
lös orsaken innan du bygger; använd inte reset för att kasta bort okända ändringar.
Kör stegen i ordning och fortsätt bara när föregående steg lyckats.
Bygget startar den nya dashboardservern; kiosken kan ändå visa äldre JavaScript
tills sidan laddas om. Kioskomstarten öppnar Väder som startvy och bevarar
webbläsarprofilen, inklusive temaval och zoom.

Samma bygge kan startas direkt från **Macens Terminal**:

```sh
ssh -t -i ~/.ssh/id_raspberry anders@vaderstation.local 'cd ~/weather-station && git pull --ff-only && sudo docker compose up -d --build'
```

När det är färdigt, starta om kiosken från Macen:

```sh
ssh -i ~/.ssh/id_raspberry anders@vaderstation.local 'cd ~/weather-station && python3 scripts/pi/restart-kiosk.py'
```

## Ladda om eller starta om enbart kiosken

Med ett tangentbord och kioskfönstret i fokus: **Ctrl+Shift+R** laddar om sidan.
**Ctrl+0** återställer zoom till 100 %. En omstart återställer inte sparad zoom.

Över SSH, eller i Pi-terminalen:

```sh
cd ~/weather-station
python3 scripts/pi/restart-kiosk.py --check
python3 scripts/pi/restart-kiosk.py
```

`--check` kontrollerar utan att starta om. Skriptet använder samma metod som
vid våra fjärromstarter: hittar huvudprocessen med kioskens särskilda profil,
läser dess skrivbordsmiljö, avslutar den med SIGTERM och startar
`~/.local/bin/weather-station-kiosk` igen. Processens miljö tas med vid starten i stället för att förlita sig på
SSH-sessionens visningsinställningar. Andra Chromium-profiler avslutas inte.
Kör **utan sudo**, som `anders`. Det kräver en redan körande kiosk och avslutar
med förklaring om ingen eller flera matchande processer hittas.

Om kiosken redan är stängd, kör från **Pi-skrivbordets terminal**:

```sh
~/.local/bin/weather-station-kiosk
```

Startaren väntar på dashboarden och öppnar
`http://localhost:3000/?kiosk=1`. Autostarten ligger i
`~/.config/labwc/autostart`. Om startaren behöver uppdateras:

```sh
cd ~/weather-station
bash scripts/pi/install-kiosk.sh
```

Det installerar startaren och bevarar andra autostartposter. Logga ut/in eller
starta kiosken igen efteråt. Kiosken har ingen egen automatisk kraschåterstart.

## Dashboard: status, logg och omstart

```sh
cd ~/weather-station
sudo docker compose ps
sudo docker compose logs --tail 100 weather-station
sudo docker compose logs -f --tail 50 weather-station
```

**Ctrl+C** avslutar loggvisningen, inte tjänsten.

Omstart av befintlig container, utan nytt bygge:

```sh
cd ~/weather-station
sudo docker compose restart weather-station
```

Efter ändring i `.env` ska containern återskapas, inte bara startas om:

```sh
cd ~/weather-station
sudo docker compose up -d
```

## Home Assistant och Matter Server

En hård omladdning av webbläsaren startar inte om Home Assistant.
Nya manuellt installerade integrationer kräver en HA-omstart.

```sh
cd ~/home-assistant
sudo docker compose ps
sudo docker compose logs --tail 100 homeassistant
sudo docker compose logs --tail 100 matter-server
sudo docker compose restart homeassistant
```

HA-omstart ger ett kort avbrott i sensorvärden och styrning. Vänta tills HA är
åtkomlig igen; dashboarden återansluter automatiskt. Matter Server kan vid behov
startas om separat med `sudo docker compose restart matter-server` från samma
mapp; det avbryter kontakten med Matter-enheter en stund. Använd det när loggarna
pekar på Matter, inte som rutin efter ett dashboardbygge.

HA-konfigurationen ligger i `~/home-assistant/data/homeassistant`.
Polestar Data Portal är manuellt installerad under dess
`custom_components/polestar_data_portal`, version 0.3.0 från
[lvlie/ha_polestar-data-portal](https://github.com/lvlie/ha_polestar-data-portal)
(revision `a217f50973ab2cc5d4c442287d18cd58159b3edb`). Denna integrationskod och
HA:s privata konfiguration ligger **utanför dashboardens Git-repo**.
En backup skapades i HA före installationen; den ersätter inte en extern backup.

Polestar-hemligheterna anges i HA, inte dashboardens `.env`. Nuvarande credential
löper ut **2026-12-16**; förnya den i Polestars portal och uppdatera integrationens
uppgifter i HA innan dess. Bilsidan läser HA:s `sensor.polestar_*` och `binary_sensor.polestar_*`. Batteri,
lås, hälsa och mätarställning har egna rapporteringstider; nya HA-avläsningar
betyder inte automatiskt att bilen har rapporterat nya värden.

## Pi: resurser och hälsokontroll

```sh
uptime
free -h
df -h /
vcgencmd measure_temp
vcgencmd get_throttled
timedatectl status
systemctl status weather-station-health.timer --no-pager
sudo journalctl -u weather-station-health.service -n 80 --no-pager
tail -n 100 ~/.local/state/weather-station/kiosk.log
```

Se [hälsokontrollens guide](deploy/health/README.md) för larm och mejl samt
[HA/Matter-guiden](deploy/home-assistant/README.md) för backup och underhåll.

## Omstart eller avstängning av hela Pi:n

```sh
sudo reboot
```

SSH-kontakten bryts. Anslut igen efter uppstart och kontrollera dashboarden.
Docker-tjänsterna och kiosken återkommer via sina befintliga startinställningar.

Vid avstängning:

```sh
sudo poweroff
```

Vänta tills Pi:n stängts av innan strömmen kopplas bort.

## Kontrollera Git manuellt

```sh
cd ~/weather-station
git fetch origin
git status --short --branch
git log -1 --oneline
git rev-list --left-right --count HEAD...origin/main
```

`0 0` betyder att HEAD och den hämtade `origin/main` är synkade. Andra tal anger
antal lokala respektive fjärrcommits som saknas på andra sidan.
Git innehåller kod, dashboardbilder och dokumentation. `.env`, HA-konfiguration,
Polestar-hemligheter, Matter-data och Docker-volymen med enhetshistorik ingår inte.
En ren Git-status innebär alltså inte att all installationsdata är säkerhetskopierad.

## USB-backup

Se [USB-backupguiden](deploy/backup/README.md) för installation, nattlig körning
03:00, de senaste 14 kopiorna, status och återställning. Backupen är installerad och första arkivet verifierat 2026-10-10.
Installation och manuell körning kräver sudo.
