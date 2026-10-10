# Restore from a USB backup

[Svenska](RESTORE.md) · [USB backup guide](README.en.md)

This is a data archive, not a bootable SD-card image. It contains secrets: HA
logins, Polestar credentials, dashboard `.env` and any SMTP configuration.
Store the USB drive securely. The archive is unencrypted.

## Verify before restoring

Run on the Pi with the USB drive mounted at `/mnt/weatherbackup`. Select an exact
filename from `ls`; replace `DATE` below with its timestamp.

```sh
sudo ls -lh /mnt/weatherbackup/weather-station-backups
cd /mnt/weatherbackup/weather-station-backups
sudo sha256sum -c weather-station-DATE.tar.gz.sha256
sudo gzip -t weather-station-DATE.tar.gz
sudo tar -tzf weather-station-DATE.tar.gz
```

The mount requires root access. If `cd` is denied, open an administrative shell
with `sudo -i`, run the commands there and leave with `exit`. Access on other
computers depends on their exFAT mounting settings; Pi permissions provide no
encryption protection.

The archive contains:

- `files.tar`: HA/Matter configuration and data, dashboard source and `.env`,
  kiosk startup and labwc configuration, existing health check and SMTP settings.
- `dashboard-data.tar`: contents of the dashboard Docker volume at `/app/data`.
- `manifest.json`: time, Git revision, container images and previous running state.
- `RESTORE.md`: Swedish restore guide. The English guide is in the repository
  at `deploy/backup/RESTORE.en.md` (also inside the backed-up source in `files.tar`
  once these documentation changes have reached the Pi).

Previous HA backup files, Git history, Node modules and build artifacts are
excluded. The current HA database and settings are included in `files.tar`.

## Prepare a replacement Pi or new SD card

Install Raspberry Pi OS 64-bit with desktop, Docker Engine and Git according to
[RASPBERRY-PI.en.md](../../RASPBERRY-PI.en.md). Use the same user and paths
(`anders`, `/home/anders`). Check time, networking, IPv6 and write permissions.
The USB drive can also be read on a Mac using exFAT to copy the archive. On a new
Pi, mount it first; the backup installer is not needed just to read and restore.

**Do not run restored HA/Matter alongside the original.** Stop the original
services first to avoid duplicate Matter identities. Make a separate copy of
any current installation before overwriting it.

## Extract and inspect in a separate directory

```sh
sudo mkdir -p /var/tmp/weather-restore
sudo chmod 700 /var/tmp/weather-restore
sudo tar -xzf /mnt/weatherbackup/weather-station-backups/weather-station-DATE.tar.gz -C /var/tmp/weather-restore
sudo cat /var/tmp/weather-restore/manifest.json
sudo tar -tf /var/tmp/weather-restore/files.tar
sudo tar -tf /var/tmp/weather-restore/dashboard-data.tar
```

Restoration overwrites files; affected services must be stopped. On an existing
Pi, stop the dashboard with `cd ~/weather-station && sudo docker compose stop`
and HA/Matter with `cd ~/home-assistant && sudo docker compose stop`.
Pause nightly backups with `sudo systemctl stop weather-station-backup.timer`
until restoration is complete. Copy or move aside old data directories so
leftover current files are not mixed with the backup.

After inspecting the archive and deciding to replace the installation:

```sh
sudo tar -xpf /var/tmp/weather-restore/files.tar --numeric-owner -C /
cd /home/anders/weather-station
sudo docker compose create --build
sudo docker compose ps -a
```

Check where the dashboard container mounts its data volume:

```sh
sudo docker inspect "$(sudo docker compose ps -a -q weather-station)" --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Source}}{{end}}{{end}}'
```

The reported path should be the dashboard volume under
`/var/lib/docker/volumes/.../_data`. Replace `VOLUME_PATH` below with that exact
path, keeping the dashboard stopped and the old volume data moved aside:

```sh
sudo tar -xpf /var/tmp/weather-restore/dashboard-data.tar --numeric-owner -C VOLUME_PATH
cd /home/anders/home-assistant
sudo docker compose up -d
cd /home/anders/weather-station
sudo docker compose up -d --build
bash scripts/pi/install-kiosk.sh
```

Docker images are not included; registry access is needed to fetch HA/Matter and
build the dashboard. Use versions from restored Compose files and compare them
with the manifest.

If the Pi's IP changed, check the HA address and allowed origins in `.env`.
Check Matter's `PRIMARY_INTERFACE` if the network interface changed. Preserve
fabric/vendor identities.

After restoring unit files, run `sudo systemctl daemon-reload`. Install/enable
the health check with `deploy/health/install.sh`, and install USB backup with
`deploy/backup/install.sh` once operation is verified. Enable desktop autologin
on a fresh OS installation; the kiosk launches on the next login.

Verify sensors, light controls, Sonos, calendar, Polestar and health checks.
Check ownership and permissions of `.env` and private configuration. Keep keys
for any separate encrypted HA backups outside the Pi. A full disaster-restoration
test remains pending; these instructions do not imply it has been performed.
