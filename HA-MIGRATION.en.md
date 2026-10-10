# Home Assistant migration to the Pi

[Svenska](HA-MIGRATION.md) · [English documentation](README.en.md)

Historical preparation and migration completed **2026-09-23**. See final status
below and [HA/Matter operations](deploy/home-assistant/README.en.md).

## Original installation and inventory

HA Core 2026.9.3 on the Mac VM; the only installed app/add-on was Matter Server
9.2.0. Matter autostart enabled, watchdog and automatic updates disabled.
Integrations included Matter, Thread, Sonos and Apple TV. The Pi had ARM64,
4 GiB RAM, about 3.1 GiB available and 48 GiB free at inventory time.
The Mac was an M3 Pro MacBook Pro with 18 GB RAM, VirtualBox 7.2.16,
HA OS 18.2 ARM64 VDI, 4096 MB VM memory, two CPUs, EFI/VirtioSCSI and bridged
Wi-Fi (`en0`). HA used port 80. Initial disk/swap troubleshooting involved removing
an empty disk and placing HAOS at port 0; the precise earlier fault was not proven.

## Preparation backup

Backup `43a9f47f`, named “Inför Pi-flytt 2026-09-23 – HA och Matter”, was downloaded
to `/Users/andersrosen/Documents/Codex/ha-backups/2026-09-23/` outside Git.
It contains HA settings/history, Matter Server 9.2.0 and share/ssl/media folders.
HA labels it `partial`; contents were explicitly checked. Size: 4,556,800 bytes.
All five encrypted subarchives passed securetar validation with the saved recovery
key. Checksums/private recovery details are in the backup directory. No trial
restore was performed at preparation. Never put backups or recovery keys in Git.

The original plan was to correct the VM clock (about ten hours behind), select
compatible standalone Matter, prepare storage/networking, take a fresh backup,
stop the Mac before starting the Pi copy and verify devices before retiring the VM.
HA Container has no add-on manager: restoring HA data does not automatically
install Matter as a separate running container.

## Completed migration, 2026-09-23

HA and Matter now run on the Pi. The Mac copy is stopped and must not run alongside
it. Restored backup `5087c284` (23 September, 09:18) was downloaded outside Git;
all five subarchives were validated with the recovery key.

- HA: <http://vaderstation.local/> (restored port 80).
- Dashboard: <http://vaderstation.local:3000/>.
- Matter retains vendor ID 4939 and fabric ID 2; otherwise a blank identity is selected.
- Matter `use_addon` and `integration_created_addon` are false;
  address `ws://127.0.0.1:5580/ws`.
- Wi-Fi IPv6 changed from ignore to auto. Netplan then reported dhcp6=true;
  Thread routes were learned and devices returned.
- Dashboard `.env` on Pi/Mac changed to `http://192.168.0.130`; reserve this address
  in the router. The Mac development server is not needed for operation.

Checks found all five light entities available, numeric readings from three
TIMMERFLOTTE sensors, responsive Sonos Kitchen/Balcony/TV room and Apple TV,
and dashboard SSE `error=null`. Lilla Roam/Samsung were unavailable. HA also logged
a Bluetooth permission warning; local Bluetooth is not configured.

## Final status and later follow-up

The user confirmed working display, reboot and over four hours of stable operation
with reasonable memory, temperature and disk space. Lilla Roam is powered off;
Samsung is excluded from further troubleshooting. Shelly BLU H&T ZB through
DIRIGERA now supplies `sensor.utetemperatur_temperatur` and
`sensor.utetemperatur_luftfuktighet`; Balcony uses real TIMMERFLOTTE values.
The Mac VM clock after reboot differed by about 0.35 seconds; later backup
5087c284 has correct date/time. Backups/private recovery data remain outside Git.

At migration, recurring external backup and trial restoration were pending.
**Update 2026-10-10:** nightly USB backup is now installed and its first archive
verified. Off-site backup and a full disaster-restoration test remain pending.

References: [HA Container](https://www.home-assistant.io/installation/linux),
[Matter integration](https://www.home-assistant.io/integrations/matter),
[Matter generation migration](https://github.com/home-assistant/addons/blob/master/matter_server/MIGRATION_FAQ.md).
