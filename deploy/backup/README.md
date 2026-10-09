# USB-backup av hela applikationsinstallationen

Avsedd för Pi:n `vaderstation`, användaren `anders` och USB-minnet **AR-128GB**,
UUID **66CD-AEC1**, exFAT. Ingen formatering görs och befintliga filer lämnas kvar.
En skriv-/återläsningskontroll på 1 MiB med SHA-256 lyckades 2026-10-10.
Det är en funktionskontroll, inte en fullständig diagnos av USB-minnets hälsa.

## Verifierad drift 2026-10-10

Installerad på Pi:n och första skarpa backupen verifierad med gzip, tar och SHA-256.
Arkivet var 27,6 MiB. Innehållskontrollen bekräftade HA-konfiguration och auth,
Matter-data, dashboardens `.env`, kioskstartare och `device-health.json`.
Containrarna återstartades efter cirka 63 sekunder; HA HTTP och bil-API svarade
utan fel och Matter rapporterade healthy. Backup- och hälsotimern är aktiva.
Fyra automatiska tester passerade även på Pi:n med isolerad testdata.
En full återställning till ett nytt SD-kort har ännu inte provats.

## Installation

På Pi:n efter att koden hämtats:

```sh
cd ~/weather-station
sudo bash deploy/backup/install.sh
```

Installationen kräver sudo och USB-minnet anslutet. Den flyttar monteringen från
skrivbordets `/media/anders/AR-128GB` till `/mnt/weatherbackup` och reserverar
just denna UUID från skrivbordets automontering via en udev-regel. Övriga
USB-minnen påverkas inte. Ingen partition eller befintlig fil ändras.
Om den gamla monteringen används av ett program kan avmonteringen misslyckas;
stäng programmet och försök igen. Backupmappen blir åtkomlig som root på Pi:n.

Installationen kör en första backup och aktiverar timern först när den lyckats.
Nattlig körning sker **03:00 Europe/Stockholm**, med sommar-/vintertid.
`Persistent=true` innebär att en missad körning tas igen efter uppstart.
Om USB-minnet saknas misslyckas körningen utan att lägga backup på SD-kortet;
anslut minnet och kör tjänsten manuellt för att försöka igen samma dag.

## Vad backupen gör

1. Kontrollerar monteringspunkt, USB-UUID och ledigt utrymme.
2. Pausar hälsokontrollens timer, HA, Matter och dashboarden. Endast containrar
   som körde före backupen startas igen efteråt.
3. Skapar två okomprimerade dataarkiv i en privat stagingkatalog på SD-kortet,
   med ägare/rättigheter bevarade inne i arkiven. Det ger sammanhängande
   kopior av HA:s databas och Matter-data.
4. Startar tjänsterna och hälsokontrollen igen före komprimeringen till USB.
5. Verifierar gzip, tar-struktur och SHA-256 från den skrivna USB-filen och
   sparar en statusfil först när allt lyckats.
6. Behåller de senaste **14 färdiga backupuppsättningarna** i den egna mappen.
   Äldre uppsättningar tas bort först efter en lyckad ny backup; andra filer rörs inte.

Tjänsterna är pausade under den lokala arkiveringen; exakt tid beror på datamängden.
Fel eller tidsgräns på 45 minuter försöker alltid återstarta de tidigare körande
containrarna via både skriptets `finally` och systemds `ExecStopPost`.
En separat recovery-tjänst läser av återstartslistan efter uppstart om en backup
avbrutits av strömavbrott. Kontrollera alltid driften efter ett sådant avbrott.
Compose behåller `restart: unless-stopped`.

Backupfiler sparas i `/mnt/weatherbackup/weather-station-backups` som
`weather-station-ÅÅÅÅMMDDTHHMMSSZ.tar.gz` och motsvarande `.sha256`. Filnamn använder
UTC, schemat svensk tid. USB-minnet måste ha minst 2 GiB ledigt; staging kräver
minst 3 GiB på SD-kortet. Vid växande HA-databas behöver dessa marginaler ses över.

Se [RESTORE.md](RESTORE.md) för innehåll och återställning. Backupen innehåller
hemligheter och är **inte krypterad**. Den ligger på ett separat fysiskt minne,
men fortfarande vid samma Pi. Kopiera regelbundet en verifierad uppsättning
till Macen eller annan separat förvaring. Git ersätter inte denna backup.

## Manuella kommandon

Kör på Pi:n:

```sh
sudo systemctl start weather-station-backup.service
systemctl list-timers weather-station-backup.timer --no-pager
systemctl status weather-station-backup.service --no-pager
sudo journalctl -u weather-station-backup.service -n 80 --no-pager
sudo cat /var/lib/weather-station-backup/last-success.json
sudo ls -lh /mnt/weatherbackup/weather-station-backups
```

`systemctl start` väntar tills körningen är klar. Vid fel finns orsaken i journalen;
`last-success.json` beskriver endast den senaste lyckade kopian, inte senaste försöket.
Ingen ny mejlavisering ingår; befintliga hälsolarm fortsätter som tidigare.

Pausa automatiken med `sudo systemctl disable --now weather-station-backup.timer`.
För säker urkoppling: kontrollera att backuptjänsten inte kör, pausa timern och
kör `sudo systemctl stop mnt-weatherbackup.mount` innan minnet tas ur. En stoppad
mount avbryter en beroende aktiv backuptjänst; undvik det mitt i en körning.
Återaktivera efter anslutning med `sudo systemctl enable --now weather-station-backup.timer`.

För att kopiera till Macen: välj ett exakt färdigt filnamn och kopiera både arkivet
och dess checksumfil. Root-behörigheterna kräver till exempel `sudo cp` till en
privat temporär katalog i `/home/anders` och `sudo chown anders:anders` på de två
filerna, följt av `scp -i ~/.ssh/id_raspberry` från Macen. Verifiera SHA-256 igen
på Macen med `shasum -a 256 -c FILNAMN.tar.gz.sha256` och rensa temporärkopiorna
när överföringen är verifierad.
