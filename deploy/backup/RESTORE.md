# Återställning från USB-backup

Backupen är ett dataarkiv, inte en startbar avbild av SD-kortet. Den innehåller
hemligheter: HA-inloggningar, Polestar-uppgifter, dashboardens `.env` och eventuell
SMTP-konfiguration. Förvara USB-minnet säkert. Arkivet är inte krypterat.

## Kontrollera backupen innan återställning

Kommandona körs på Pi:n med USB-minnet monterat på `/mnt/weatherbackup`.
Välj exakt filnamn från `ls`; ersätt `DATUM` nedan med tidsdelen i det namnet.

```sh
sudo ls -lh /mnt/weatherbackup/weather-station-backups
cd /mnt/weatherbackup/weather-station-backups
sudo sha256sum -c weather-station-DATUM.tar.gz.sha256
sudo gzip -t weather-station-DATUM.tar.gz
sudo tar -tzf weather-station-DATUM.tar.gz
```

Monteringen har root-behörigheter. Om `cd` nekas: öppna en administrativ terminal
med `sudo -i`, kör kommandona där och avsluta med `exit`. Alla användares
arkivåtkomst på andra datorer beror på hur de monterar exFAT; rättigheter på Pi:n
är inget krypteringsskydd.

Arkivet innehåller:

- `files.tar`: HA- och Matter-konfiguration/data, dashboardkällkod och `.env`,
  kioskstart och labwc-konfiguration samt befintlig hälsokontroll och SMTP-inställningar.
- `dashboard-data.tar`: innehållet i dashboardens Docker-volym `/app/data`.
- `manifest.json`: tid, Git-revision, containerbilder och tidigare körstatus.
- `RESTORE.md`: denna guide.

HA:s tidigare backupfiler, Git-historik, Node-moduler och byggartefakter ingår
inte; HA:s aktuella databas och inställningar ingår i `files.tar`.

## Förbered en ersättnings-Pi eller ett nytt SD-kort

Installera Raspberry Pi OS 64-bit med skrivbord, Docker Engine och Git enligt
projektets `RASPBERRY-PI.md`. Använd samma användare och sökvägar (`anders`,
`/home/anders`). Kontrollera tid, nätverk, IPv6 och skrivrättigheter.
USB-minnet kan läsas med exFAT även från en Mac för att kopiera arkivet.
På en ny Pi behöver du montera det; backupens installationsskript behövs inte
för att bara läsa och återställa filer.

**Kör inte en återställd HA/Matter-instans samtidigt som originalet.**
Stoppa originalets tjänster först så befintliga Matter-identiteter inte dubbleras.
Ta en separat kopia av eventuell nuvarande installation innan något skrivs över.

## Packa upp och granska i en separat katalog

```sh
sudo mkdir -p /var/tmp/weather-restore
sudo chmod 700 /var/tmp/weather-restore
sudo tar -xzf /mnt/weatherbackup/weather-station-backups/weather-station-DATUM.tar.gz -C /var/tmp/weather-restore
sudo cat /var/tmp/weather-restore/manifest.json
sudo tar -tf /var/tmp/weather-restore/files.tar
sudo tar -tf /var/tmp/weather-restore/dashboard-data.tar
```

Återställning skriver över filer och ska göras med berörda tjänster stoppade.
Vid återställning på en befintlig Pi: stoppa dashboarden med
`cd ~/weather-station && sudo docker compose stop`, och HA/Matter med
`cd ~/home-assistant && sudo docker compose stop`. Pausa även nattlig backuptimer
med `sudo systemctl stop weather-station-backup.timer` tills återställningen är klar.
Kopiera eller flytta undan de gamla datakatalogerna så att överblivna filer från
nuvarande installation inte blandas med backupen.

När du har granskat arkivets innehåll och är redo att ersätta installationen:

```sh
sudo tar -xpf /var/tmp/weather-restore/files.tar --numeric-owner -C /
cd /home/anders/weather-station
sudo docker compose create --build
sudo docker compose ps -a
```

Kontrollera var dashboardcontainern monterar sin datavolym:

```sh
sudo docker inspect "$(sudo docker compose ps -a -q weather-station)" --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Source}}{{end}}{{end}}'
```

Den rapporterade sökvägen ska vara dashboardens datavolym under
`/var/lib/docker/volumes/.../_data`. Ersätt `VOLYMSÖKVÄG` med exakt den sökvägen
nedan, med dashboarden stoppad och den gamla volymdatan undanlagd:

```sh
sudo tar -xpf /var/tmp/weather-restore/dashboard-data.tar --numeric-owner -C VOLYMSÖKVÄG
cd /home/anders/home-assistant
sudo docker compose up -d
cd /home/anders/weather-station
sudo docker compose up -d --build
bash scripts/pi/install-kiosk.sh
```

Dockerbilder ingår inte i backupen; nätåtkomst till registren behövs för
att hämta HA/Matter och bygga dashboarden. Använd versionerna i den återställda
Compose-konfigurationen och kontrollera dem mot manifestet.

Kontrollera dashboardens HA-adress och tillåtna webbadresser i `.env` om Pi:n
fått en ny IP-adress. Kontrollera Matter-inställningen `PRIMARY_INTERFACE` om
nätverksgränssnittet ändrats. Bevara fabric/vendor-identiteterna.

Starta om systemd efter återställda enhetsfiler med `sudo systemctl daemon-reload`.
Installera/aktivera hälsokontrollen från `deploy/health/install.sh`, och installera
USB-backupen från `deploy/backup/install.sh` när driften är verifierad. Aktivera
skrivbordets autoinloggning vid ominstallation; kiosken startar vid nästa inloggning.

Verifiera temperaturgivare, lampstyrning, Sonos, kalender, Polestar och
hälsokontroll. Kontrollera att `.env` och privata konfigurationer har rätt ägare
och rättigheter. Återställningsnycklar för eventuella separata krypterade
HA-backuper måste förvaras utanför Pi:n.
