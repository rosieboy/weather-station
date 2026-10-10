# Home Assistant and Matter on the Pi

[Svenska](README.md) · [English documentation](../../README.en.md)

In operation since 2026-09-23, restored from the Mac's HA OS installation. Runs
on Raspberry Pi OS 64-bit with Docker Engine. Dashboard Compose is separate.

Versions match the previous installation: HA Core 2026.9.3 and Matter add-on 9.2.0,
based on matterjs-server 1.4.0. Do not switch to `latest` during migration.
Configuration on this Pi lives in `/home/anders/home-assistant`; storage is in
`data/homeassistant` and `data/matter-server`. Restored data contains secrets and
must not be committed to Git.

## Prepare without starting

```bash
cd ~/home-assistant
sudo docker compose config --quiet
sudo docker compose pull
```

`pull` only downloads images. For a new migration, restore the backup and stop
the old HA/Matter before `up`. Services are already running in this installation.

## Migration procedure

- Take a fresh backup and check the recovery key.
- Stop the old installation before starting its restored copy.
- Restore HA configuration and Matter storage separately. HA Container does not
  restore a Supervisor add-on as a running container. Inspect internal archive
  paths before copying files.
- Change the Matter integration address from the add-on hostname to
  `ws://127.0.0.1:5580/ws` in HA. Both containers use host networking.
- Review restored HA settings, including HTTP port and old Supervisor dependencies.
  A clean install uses port 8123; restored settings may select another port.
- Start and verify sensors, lights, Sonos, Apple TV and automations. Switch the
  dashboard server address only after these work.

Matter WebSocket listens only on loopback. Matter traffic uses `wlan0`, the Pi's
current connection. Before switching to Ethernet, check IPv6/multicast and update
`PRIMARY_INTERFACE`. Local IPv6 must work even if internet access uses only IPv4.
Bluetooth and D-Bus are not exposed in this setup. Existing network-connected
devices are the focus; new pairing through local Bluetooth needs separate setup.
No container receives general privileged access.

## Maintenance

Change one service version at a time. Back up both data directories with services
stopped and save the copy outside the Pi. Then pull the new image and recreate
that service. Downgrading may require restoring old data. OS updates are separate
via SSH; kiosk mode does not prevent administration.

## Verified migration adjustments

- Keep vendor ID 4939 and fabric ID 2 to retain existing pairings.
- Matter integration uses `use_addon=false` and `integration_created_addon=false`.
  `scripts/pi/fix-matter-container.sh` is migration-specific and stops HA before
  editing settings. Do not run it routinely.
- HA uses port 80; Matter WebSocket uses 127.0.0.1:5580.
- NetworkManager Wi-Fi IPv6 changed from ignore to auto. Netplan then reported
  dhcp6=true and Thread routes returned. Operation after reboot was confirmed.
  Do not initiate new pairing to troubleshoot a network fault.
- Keep the Mac installation stopped. Stop Pi services first before reverting.

References: [HA Container installation](https://www.home-assistant.io/installation/linux),
[Matter add-on changelog](https://github.com/home-assistant/addons/blob/master/matter_server/CHANGELOG.md),
[Matter Docker documentation](https://github.com/matter-js/matterjs-server/blob/main/docs/docker.md).
