#!/usr/bin/env bash
# Run as the desktop user, from labwc autostart. Never run as root.
set -euo pipefail
if [[ $(uname -s) != Linux || ${EUID} -eq 0 ]]; then
  echo 'Kör detta som skrivbordsanvändaren på Pi:n.' >&2
  exit 1
fi
command -v chromium >/dev/null
command -v curl >/dev/null
command -v flock >/dev/null
mkdir -p "$HOME/.local/state/weather-station"
exec 9>"$HOME/.local/state/weather-station/kiosk.lock"
flock -n 9 || exit 0
until curl --fail --silent --max-time 5 http://localhost:3000/ >/dev/null; do
  sleep 3
done
# A separate profile preserves the dashboard theme without disturbing normal browsing.
exec chromium --kiosk --no-first-run --ozone-platform=wayland \
  --user-data-dir="$HOME/.local/share/weather-station-chromium" \
  http://localhost:3000/
