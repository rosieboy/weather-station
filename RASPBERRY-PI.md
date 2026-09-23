# Väderstationen på Raspberry Pi

Installerat och verifierat 2026-09-23: Raspberry Pi 5, Raspberry Pi OS 64-bit
med skrivbord (Wayland/labwc), Docker Engine och Chromium i kiosk.

## Aktuell drift

Sensorer och DIRIGERA → Matter Server på Pi → HA Container på Pi → dashboard → Chromium.
Sonos, Apple TV och väderintegrationer hanteras av HA.

Dashboarden finns på `http://vaderstation.local:3000/`, HA på
`http://vaderstation.local/` (port 80). Macens HA-VM är stoppad. Se
[HA-MIGRATION.md](HA-MIGRATION.md) för backup, fel som löstes och verifiering.
HA/Matter kör från `~/home-assistant`; dashboarden från `~/weather-station`.
Följande installationssteg bevaras för ominstallation. HA OS ska inte skrivas
till Pi:ns systemdisk eftersom det skulle ersätta skrivbordet och kiosken.

## Idag: val och förberedelser på Macen

Hämta [Raspberry Pi Imager från Raspberry Pi](https://www.raspberrypi.com/software/).
Välj Raspberry Pi 5 och **Raspberry Pi OS (64-bit), med skrivbord**. Välj inte
Lite, Full eller PC/Mac-utgåvan ”Raspberry Pi Desktop”. Den vanliga
skrivbordsutgåvan räcker. Den officiella listan anger vid kontrollen Debian 13
Trixie, utgåva 2026-09-15. Imagers aktuella rekommenderade stabila 64-bitarsutgåva
är förstahandsvalet om listan ändras.

Ingen OS-avbild har laddats ned av agenten: den automatiska hämtningen nekades
av nedladdningsservern. Imager hämtar och verifierar den när kortet skrivs.
Ingen disk eller något minneskort har ändrats under förberedelsen.

Förbered följande val i Imager när kortet finns:

| Inställning | Vårt val |
| --- | --- |
| Värdnamn | `vaderstation` |
| Användare | `anders` (exemplet i resten av guiden) |
| Lösenord | Välj själv i Imager; spara inte i repot |
| Tidszon | Europe/Stockholm |
| Tangentbord / Wi-Fi-land | Sverige / SE |
| Nätverk | Ethernet om möjligt, annars hemmets Wi-Fi |
| SSH | Aktivera, helst med din Macs befintliga publika SSH-nyckel |

Använd ett microSD-kort på minst 32 GB. 1 GB-kortet räcker inte.
Imagers skrivning raderar det valda kortet: kontrollera diskens namn och storlek
innan du bekräftar. Låt verifieringen slutföras och mata ut kortet.

## I morgon: montering och första start

1. Montera kylning och anslut skärmen enligt tillbehörens anvisningar med strömmen urkopplad.
2. Sätt i det färdigskrivna kortet. Anslut nätverk och eventuell HDMI-skärm/tangentbord.
   Pi 5 använder micro-HDMI. Pekskärmens bandkabel ansluts enligt dess egen manual.
3. Anslut den avsedda Pi-strömförsörjningen. Vänta in första uppstarten.
4. Kontrollera skrivbord och nätverk. Prova från Macens Terminal:

```sh
ssh anders@vaderstation.local
```

Om namnet inte hittas, använd Pi:ns IP-adress från routern. Kontrollera SSH:s
värdnyckel vid första anslutningen. Använd ditt valda användarnamn om det inte är `anders`.

**Resten av installationskommandona körs på Pi:n**, via SSH eller Pi-terminalen.

```sh
uname -m
cat /etc/os-release
sudo apt update
sudo apt full-upgrade
sudo apt install git curl ca-certificates chromium
sudo timedatectl set-timezone Europe/Stockholm
timedatectl status
```

Arkitekturen ska vara `aarch64`; paketarkitekturen nedan ska vara `arm64`.
Starta om efter systemuppdateringen vid behov, och anslut igen.

## Docker Engine på Pi:n

Vi använder Docker Engine, inte Docker Desktop. Följ
[Dockers officiella Debian-instruktion](https://docs.docker.com/engine/install/debian/).
För den nya 64-bitarsinstallationen kan följande köras:

```sh
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf '%s\n' "$VERSION_CODENAME"
dpkg --print-architecture
```

Fortsätt när värdena är `trixie` och `arm64` för den valda utgåvan.

```sh
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: arm64
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

Vi använder `sudo docker` här och behöver inte lägga användaren i Docker-gruppen.

## Hämta projektet och dess privata konfiguration

På Pi:n:

```sh
git clone https://github.com/rosieboy/weather-station.git
cd ~/weather-station
```

Om GitHub kräver inloggning använder vi ditt vanliga GitHub-/SSH-flöde. Lägg inga
GitHub-token i clone-adressen eller dokumentationen.

Kopiera den fungerande `.env`-filen **från Macens Terminal**:

```sh
scp '/Users/andersrosen/Documents/Codex/2026-09-13/referenced-chatgpt-conversation-this-is-an/weather-station/.env' anders@vaderstation.local:weather-station/.env
```

Tillbaka på Pi:n:

```sh
cd ~/weather-station
chmod 600 .env
nano .env
```

Behåll sensorernas och Sonos-enheternas befintliga id:n och HA-token. Justera:

```dotenv
ORIGIN=http://localhost:3000
CONTROL_ALLOWED_ORIGINS=http://vaderstation.local:3000
```

Lägg även till `http://PI-NS-IP:3000` kommaseparerat om du använder IP-adressen i
webbläsaren; ersätt exemplet med den riktiga adressen. Detta tillåter alla
hemmets enheter som besöker dessa serveradresser, inte bara en viss iPad.
Macens gamla adress behöver inte följa med till Pi-konfigurationen.

`HOME_ASSISTANT_URL` ska peka på HA-VM:ns nåbara LAN-adress, exempelvis det
befintliga `http://homeassistant.local`. Om namnuppslagningen inte fungerar
inne i Docker använder vi VM:ns IP och dess verkliga port. Använd inte Pi:ns
`localhost` här. VirtualBox behöver fortsatt vara nåbar från hemnätverket.

`.env` innehåller hemligheter, är git-ignorerad och ska inte checkas in.
Port 3000 är tillgänglig på hemnätverket utan inloggning enligt vårt val.
Denna guide öppnar ingen port i routern för internetåtkomst.

## Starta dashboarden

På Pi:n, i projektmappen:

```sh
sudo docker compose up -d --build
sudo docker compose ps
curl --fail http://localhost:3000/ >/dev/null
```

Första bygget kan ta några minuter. Docker bygger för Pi:ns ARM64-arkitektur;
Node eller npm behöver inte installeras på värdsystemet. Testa
`http://vaderstation.local:3000` från Mac/iPad och `http://localhost:3000` i
Chromium på Pi:n. Kontrollera verkliga sensorvärden innan kioskstarten aktiveras.

Compose har redan `restart: unless-stopped`: appen startar igen efter omstart
så länge den inte uttryckligen stoppats. Efter en `.env`-ändring kör du
`sudo docker compose up -d` så att containern återskapas med rätt värden.

## Skärm och automatisk helskärm

På Pi-skrivbordet: ställ in skärmens orientering till liggande och verifiera
1280 × 720 om det är vår 7-tumsskärm. Kontrollera touch efter rotationen.
Använd skrivbordets skärminställningar; vi hårdkodar inga gamla X11-kommandon.

Kör `sudo raspi-config` och välj **Desktop Autologin** i boot-/inloggningsvalen.
Stäng även av **Screen Blanking** för den väggmonterade skärmen. Menynamnen kan
variera något med OS-versionen. Autoinloggning innebär att den lokala skärmen
öppnas utan lösenord; SSH använder fortfarande sin egen autentisering.

Installera vår startare, utan sudo, som samma användare som skrivbordet:

```sh
cd ~/weather-station
bash scripts/pi/install-kiosk.sh
```

Installationen sparar den befintliga labwc-autostarten och lägger till en enda
startpost. Startaren väntar på HTTP-svar från appen och öppnar Chromium i helskärm
med en separat profil. Temaval bevaras. Den startar inte flera kioskinstanser.

Kioskprofilen använder `--password-store=basic` för att undvika dialogen
**Unlock Keyring** vid automatisk skrivbordsinloggning. Använd profilen endast
för dashboarden och spara inga lösenord i den: lagringen har inte nyckelringens
krypteringsskydd. Pi:ns lösenord och övriga nyckelring påverkas inte.
Home Assistant-token finns på servern, inte i kioskprofilen.
Se [Chromiums dokumentation om lösenordslagring](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/password_storage.md).

Om en äldre installation visar dialogen: uppdatera repot och kör
`bash scripts/pi/install-kiosk.sh` igen. Starta sedan om Pi:n och kontrollera
att dashboarden öppnas utan lösenordsdialog. En vit skärm som kvarstår även
utan dialog behöver felsökas separat via kioskloggen nedan.
Den återstartar inte Chromium efter en manuell stängning eller krasch; logga in
på nytt eller kör `~/.local/bin/weather-station-kiosk` från Pi-skrivbordets terminal.

Starta sedan om Pi:n och kontrollera att dashboarden visas automatiskt.
Alt+F4 lämnar kiosken med tangentbord. För att avaktivera autostart: ta bort de
två raderna under markören `# weather-station kiosk` i
`~/.config/labwc/autostart`. Övriga skrivbordsstarter ska vara kvar.

## Kontrollista på hårdvaran

- [ ] Skrivbordet är 64-bit och klockan är NTP-synkroniserad.
- [ ] Temperaturer och väder kommer från den befintliga HA-instansen.
- [ ] Lampstatus ändras även efter en automation utanför dashboarden.
- [ ] Köksö tak kan dimmas och rätt nivå återkommer från HA.
- [ ] Kontroller fungerar från iPad via Pi:ns adress.
- [ ] Skärm och touch är rättvända; alla vyer ryms.
- [ ] Moln/nederbörd är mjuka utan hög kontinuerlig CPU-belastning.
- [x] App och helskärm återkommer efter omstart (bekräftat av användaren).
- [ ] Återanslutning fungerar när Home Assistant startas om.

Felsök på Pi:n:

```sh
sudo docker compose logs --tail 100
cat ~/.local/state/weather-station/kiosk.log
free -h
vcgencmd measure_temp
vcgencmd get_throttled
```

”Otillåtet ursprung”: kontrollera exakt protokoll, servernamn/IP och port i
`CONTROL_ALLOWED_ORIGINS`, och återskapa containern. Ingen sensoranslutning:
kontrollera `cd ~/home-assistant && sudo docker compose ps` samt HA-adressen.
Dashboardens `.env` använder nu `HOME_ASSISTANT_URL=http://192.168.0.130`.

För uppdatering: `git pull --ff-only` följt av `sudo docker compose up -d --build`.
Ladda sedan om webbläsaren. Stäng av med `sudo poweroff` innan strömmen kopplas ur.

## Källor

- [Raspberry Pi OS-utgåvor](https://www.raspberrypi.com/software/operating-systems/)
- [Installation och Imager](https://www.raspberrypi.com/documentation/computers/getting-started.html)
- [Raspberry Pis kioskguide för labwc](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)
- [Docker Engine på Debian ARM64](https://docs.docker.com/engine/install/debian/)

## Löpande underhåll

Administrera via SSH även när skärmen är i kiosk. Ta backup före uppdateringar.
OS: `sudo apt update` följt av `sudo apt full-upgrade`; planera eventuell
`sudo reboot` när ett kort avbrott passar. Kör inte automatisk OS-uppgradering
mitt i en HA/Matter-flytt.

Dashboard: `git pull --ff-only` och `sudo docker compose up -d --build` i
`~/weather-station`. HA/Matter: se [driftguiden](deploy/home-assistant/README.md).
Versionsändringar görs uttryckligen, en tjänst åt gången. Kontrollera sensorer,
lampor och ljud efteråt. En backup enbart på samma SD-kort räcker inte.

Kiosken fungerar efter upplåsningfri start med `--password-store=basic` i sin
separata profil. Inga lösenord ska sparas i den profilen. SSH-nycklar är separata.
Omstartstest efter HA-flytten är genomfört och fungerar enligt användaren.

## Hälsokontroll

Systemd-timer och installationsskript finns i [deploy/health](deploy/health/README.md).
Kontrollerna täcker resurser, containrar, HTTP och dashboardens sensorflöde.
Tre fel i följd ger ett lokalt larm i journalen; mejl och automatisk reparation ingår inte.
Installerad och verifierad 2026-09-23: timern är aktiverad och första körningen
godkände samtliga 11 kontroller.
