# USB backup of the application installation

[Svenska](README.md) · [English documentation](../../README.en.md)

For Pi `vaderstation`, user `anders` and the **AR-128GB** USB drive, UUID
**66CD-AEC1**, exFAT. No formatting is performed; existing files are preserved.
A 1 MiB write/read test with SHA-256 passed on 2026-10-10. This is a functional
check, not a complete drive-health diagnosis.

## Verified operation, 2026-10-10

Installed on the Pi. The first production backup passed gzip, tar and SHA-256
verification. The archive was 27.6 MiB. Content inspection confirmed HA
configuration and authentication, Matter data, dashboard `.env`, kiosk launcher
and `device-health.json`. Containers resumed after about 63 seconds; HA HTTP and
the car API responded without errors, and Matter reported healthy. Backup and
health timers are active. Four automated tests also passed on the Pi using
isolated test data. A complete restoration to a new SD card has not been tested.

## Installation

On the Pi after fetching the code:

```sh
cd ~/weather-station
sudo bash deploy/backup/install.sh
```

Requires sudo and the connected USB drive. Moves its mount from
`/media/anders/AR-128GB` to `/mnt/weatherbackup` and reserves this UUID from desktop
automounting using a udev rule. Other USB drives are unaffected. No partition or
existing file is changed. If an application uses the old mount, unmounting may
fail; close the application and retry. The backup directory requires root access
on the Pi.

The installer runs a first backup and enables the timer only after success.
Runs nightly at **03:00 Europe/Stockholm**, including daylight-saving changes.
`Persistent=true` catches up a missed run after boot. If the drive is missing, the
run fails without putting the backup on the SD card. Reconnect it and start the
service manually to retry that day.

## What the backup does

1. Checks the mount point, USB UUID and free space.
2. Pauses the health timer, HA, Matter and dashboard. Only containers that were
   running before the backup are restarted afterward.
3. Creates two uncompressed data archives in a private staging directory on the
   SD card, preserving ownership and permissions inside the archives. This gives
   consistent copies of the HA database and Matter data.
4. Restarts services and the health timer before compression to USB.
5. Verifies gzip, tar structure and SHA-256 from the written USB file; saves the
   success status only after all checks pass.
6. Keeps the latest **14 completed backup sets** in its own directory. Older sets
   are removed only after a successful new backup; unrelated files are untouched.

Services pause during local archiving; duration depends on data size. Errors or
the 45-minute timeout attempt to restart previously running containers through
both the script's `finally` and systemd's `ExecStopPost`. A separate recovery
service reads the restart list after boot if power interrupted a backup. Check
operation after such an interruption. Compose retains `restart: unless-stopped`.

Files are stored in `/mnt/weatherbackup/weather-station-backups` as
`weather-station-YYYYMMDDTHHMMSSZ.tar.gz` and the corresponding `.sha256` file.
Names use UTC; scheduling uses Swedish time. USB needs at least 2 GiB free;
SD staging needs at least 3 GiB. Revisit these margins as the HA database grows.

See [RESTORE.en.md](RESTORE.en.md) for contents and restoration. Backups contain
secrets and are **unencrypted**. The drive is physically separate but remains at
the same Pi. Regularly copy a verified set to the Mac or other separate storage.
Git does not replace this backup.

## Manual commands

Run on the Pi:

```sh
sudo systemctl start weather-station-backup.service
systemctl list-timers weather-station-backup.timer --no-pager
systemctl status weather-station-backup.service --no-pager
sudo journalctl -u weather-station-backup.service -n 80 --no-pager
sudo cat /var/lib/weather-station-backup/last-success.json
sudo ls -lh /mnt/weatherbackup/weather-station-backups
```

`systemctl start` waits for completion. Errors appear in the journal.
`last-success.json` describes the latest successful backup, not the latest
attempt. No new email notification is included; existing health alerts continue.

Pause scheduling with `sudo systemctl disable --now weather-station-backup.timer`.
Before disconnecting the drive, check that the backup service is not running,
pause its timer, then run `sudo systemctl stop mnt-weatherbackup.mount`.
Stopping the mount stops a dependent active backup service; avoid doing this
mid-run. After reconnecting, enable scheduling with
`sudo systemctl enable --now weather-station-backup.timer`.

To copy to the Mac, select an exact completed filename and copy both archive and
checksum. Root permissions require, for example, `sudo cp` into a private
temporary directory in `/home/anders`, then `sudo chown anders:anders` on those
two files. Use `scp -i ~/.ssh/id_raspberry` from the Mac. Verify again on the Mac
with `shasum -a 256 -c FILENAME.tar.gz.sha256`, then remove the temporary copies
once the transfer is verified.
