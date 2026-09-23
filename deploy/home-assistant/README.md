# HA och Matter på Pi:n

I drift sedan 2026-09-23, återställt från Macens HA OS. Kör på Raspberry Pi OS
64-bit med Docker Engine. Dashboardens Compose-projekt är separat.

Versionerna matchar befintlig HA: Core 2026.9.3 och Matter-tillägg 9.2.0,
som bygger på matterjs-server 1.4.0. Ändra inte till `latest` under flytten.

På den aktuella Pi:n ligger denna konfiguration i `/home/anders/home-assistant`.
Lagring ligger under `data/homeassistant` respektive `data/matter-server`.
Den innehåller hemligheter efter återställning och får inte checkas in i Git.

## Förbered utan att starta

```bash
cd ~/home-assistant
sudo docker compose config --quiet
sudo docker compose pull
```

`pull` hämtar enbart bilderna. Vid ny migrering ska backupen återställas och
gamla HA/Matter stoppas före `up`. I aktuell drift är tjänsterna redan startade.

## Vid själva flytten

- Ta färsk backup och kontrollera återställningsnyckeln.
- Stoppa den gamla installationen innan dess återställda kopia startas.
- Återställ HA-konfigurationen och Matter-serverns lagring separat.
  HA Container återställer inte ett Supervisor-tillägg som körbar container.
  Kontrollera backupens interna katalogstruktur innan filer kopieras.
- Byt Matter-integrationens adress från tilläggets värdnamn till
  `ws://127.0.0.1:5580/ws` i HA. Båda containrarna använder värdens nätverk.
- Granska återställda HA-inställningar för bland annat HTTP-port och gamla
  Supervisor-beroenden. En ren installation använder port 8123; en återställd
  konfiguration kan ha valt en annan port.
- Starta sedan och verifiera sensorer, lampor, Sonos, Apple TV och automationer.
  Koppla om dashboardens serveradress först när detta fungerar.

Matter-serverns WebSocket lyssnar bara på loopback. Matter-trafiken går via
`wlan0`, som är Pi:ns nuvarande nätverksanslutning. Vid byte till Ethernet ska
`PRIMARY_INTERFACE` ändras efter kontroll av IPv6 och multicast på det nätet.
IPv6 måste fungera lokalt, även om internetanslutningen bara använder IPv4.

Bluetooth och D-Bus är inte exponerade i denna förberedelse. Befintliga
nätverksanslutna enheter är fokus; ny parkoppling via lokal Bluetooth kräver
separat konfiguration. Ingen container får generell privileged-åtkomst.

## Underhåll

Ändra version av en tjänst åt gången, ta backup av båda datakatalogerna med
tjänsterna stoppade och spara kopian utanför Pi:n. Hämta därefter den nya bilden
och återskapa berörd tjänst. Nedgradering kan kräva återställning av gammal data.
OS-uppdatering sker separat via SSH; kioskläget hindrar inte administrationen.

Källor:
- https://www.home-assistant.io/installation/linux
- https://github.com/home-assistant/addons/blob/master/matter_server/CHANGELOG.md
- https://github.com/matter-js/matterjs-server/blob/main/docs/docker.md

## Verifierade anpassningar vid flytten

- Vendor ID 4939 och fabric ID 2 måste behållas för befintliga parkopplingar.
- `use_addon=false` och `integration_created_addon=false` i Matter-integrationen.
  Reparationsskriptet `scripts/pi/fix-matter-container.sh` är endast för denna
  migrering och stoppar HA innan inställningen ändras. Kör det inte rutinmässigt.
- HA använder port 80. Matter WebSocket lyssnar på 127.0.0.1:5580.
- Wi-Fi-profilens IPv6-metod ändrades från ignore till auto via NetworkManager.
  Netplan rapporterade därefter dhcp6=true och Thread-rutter återkom. Användaren har
  bekräftat fungerande drift efter omstart. Starta inte en ny parkoppling vid nätverksfel.
- MAC-installationen ska hållas stoppad. Vid återgång: stoppa först Pi-tjänsterna.
