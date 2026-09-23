#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Kör med sudo på Pi:n.' >&2; exit 1; }
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
command -v docker >/dev/null
command -v curl >/dev/null
test -x /usr/bin/vcgencmd
install -d -m 755 /usr/local/lib/weather-station-health
install -m 644 pi-health.py /usr/local/lib/weather-station-health/pi-health.py
install -m 644 weather-station-health.service weather-station-health.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/weather-station-health.service /etc/systemd/system/weather-station-health.timer
systemctl daemon-reload
systemctl enable --now weather-station-health.timer
systemctl start weather-station-health.service
systemctl list-timers weather-station-health.timer --no-pager
