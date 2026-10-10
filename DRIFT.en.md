# Manual operation of the weather station

[ Svenska ](DRIFT.md) · [English documentation](README.en.md)

Checked against the installation on **2026-10-10**. The Pi user is `anders`,
hostname `vaderstation.local`. The dashboard runs from `~/weather-station`;
Home Assistant and Matter Server run from `~/home-assistant`.

- Dashboard: <http://vaderstation.local:3000/>
- Home Assistant: <http://vaderstation.local/>

## Connect from the Mac

Run in **Terminal on the Mac**:

```sh
ssh -t -i ~/.ssh/id_raspberry anders@vaderstation.local
```

After connecting, run the remaining commands **on the Pi**, unless stated otherwise.
`sudo` asks for the Pi user's password. Keep passwords and API secrets out of Git
and operation logs.

## Update after a GitHub change

On the Pi:

```sh
cd ~/weather-station
git status --short
git pull --ff-only
sudo docker compose up -d --build
sudo docker compose ps
curl --fail --silent http://localhost:3000/ >/dev/null && echo 'Dashboard responds'
python3 scripts/pi/restart-kiosk.py
```

An empty `git status --short` means no local changes. If pull fails, resolve the
cause before building; do not reset away unknown changes. Run each step in order
and continue only after success. Building starts the new server, but the kiosk
may display old JavaScript until reloaded. Restarting the kiosk opens Weather and
preserves the browser profile, including theme and zoom.

To build directly from **Terminal on the Mac**:

```sh
ssh -t -i ~/.ssh/id_raspberry anders@vaderstation.local 'cd ~/weather-station && git pull --ff-only && sudo docker compose up -d --build'
```

After completion, restart the kiosk from the Mac:

```sh
ssh -i ~/.ssh/id_raspberry anders@vaderstation.local 'cd ~/weather-station && python3 scripts/pi/restart-kiosk.py'
```

## Reload or restart only the kiosk

With a keyboard and the kiosk window focused, **Ctrl+Shift+R** reloads the page.
**Ctrl+0** resets zoom to 100%. Restarting does not reset saved zoom.

Over SSH or in the Pi terminal:

```sh
cd ~/weather-station
python3 scripts/pi/restart-kiosk.py --check
python3 scripts/pi/restart-kiosk.py
```

`--check` checks without restarting. The script finds the main Chromium process
using the dedicated kiosk profile, reads its desktop environment, terminates it
with SIGTERM and starts `~/.local/bin/weather-station-kiosk` again. It carries the
process environment into the new launch rather than relying on SSH display
settings. Other Chromium profiles are left running. Run **without sudo**, as
`anders`. A running kiosk is required; zero or multiple matching processes cause
an explanatory error.

If the kiosk is already closed, run from the **Pi desktop terminal**:

```sh
~/.local/bin/weather-station-kiosk
```

The launcher waits for the dashboard and opens `http://localhost:3000/?kiosk=1`.
Autostart is in `~/.config/labwc/autostart`. To update the launcher:

```sh
cd ~/weather-station
bash scripts/pi/install-kiosk.sh
```

Other autostart entries are preserved. Log out/in or relaunch the kiosk afterward.
The kiosk does not automatically restart Chromium after a crash.

## Dashboard status, logs and restart

```sh
cd ~/weather-station
sudo docker compose ps
sudo docker compose logs --tail 100 weather-station
sudo docker compose logs -f --tail 50 weather-station
```

**Ctrl+C** stops following logs, not the service. Restart the existing container
without building:

```sh
cd ~/weather-station
sudo docker compose restart weather-station
```

After editing `.env`, recreate the container rather than merely restarting it:

```sh
cd ~/weather-station
sudo docker compose up -d
```

## Home Assistant and Matter Server

A hard browser reload does not restart Home Assistant. Newly installed custom
integrations require an HA restart.

```sh
cd ~/home-assistant
sudo docker compose ps
sudo docker compose logs --tail 100 homeassistant
sudo docker compose logs --tail 100 matter-server
sudo docker compose restart homeassistant
```

HA restarts briefly interrupt readings and controls. Wait until HA responds; the
dashboard reconnects automatically. If needed, restart Matter separately with
`sudo docker compose restart matter-server` from the same directory. This briefly
interrupts Matter device connectivity; use it when logs point to Matter, rather
than routinely after dashboard builds.

HA configuration is in `~/home-assistant/data/homeassistant`. Polestar Data Portal
0.3.0 is installed manually in `custom_components/polestar_data_portal`, from
[lvlie/ha_polestar-data-portal](https://github.com/lvlie/ha_polestar-data-portal),
revision `a217f50973ab2cc5d4c442287d18cd58159b3edb`. Its code and private HA
configuration are **outside the dashboard Git repository**. An HA backup was
created before installation; it does not replace an external backup.

Polestar credentials belong in HA, not the dashboard `.env`. The current
credential expires **2026-12-16**. Renew it in the Polestar portal and update HA
before then. The car view reads HA's `sensor.polestar_*` and `binary_sensor.polestar_*`.
Battery, locks, health and mileage have their own reporting timestamps. Reading
HA again does not mean the car has reported new data.

## Pi resources and health checks

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

See the [health guide](deploy/health/README.en.md) for alerts and mail, and the
[HA/Matter guide](deploy/home-assistant/README.en.md) for maintenance.

## Reboot or shut down the entire Pi

```sh
sudo reboot
```

SSH disconnects. Reconnect after boot and check the dashboard. Docker services
and the kiosk return through their existing startup configuration.

To shut down:

```sh
sudo poweroff
```

Wait for shutdown before disconnecting power.

## Check Git manually

```sh
cd ~/weather-station
git fetch origin
git status --short --branch
git log -1 --oneline
git rev-list --left-right --count HEAD...origin/main
```

`0 0` means HEAD and the fetched `origin/main` are synchronized. Other values count
local and remote commits missing on the other side. Git contains code, dashboard
images and documentation. It excludes `.env`, HA configuration, Polestar secrets,
Matter data and the Docker device-history volume. A clean Git status does not
mean all installation data is backed up.

## USB backup

See the [USB backup guide](deploy/backup/README.en.md) for installation, nightly
03:00 runs, retention of 14 backups, status and restoration. Installed and first
archive verified on 2026-10-10. Installation and manual runs require sudo.
