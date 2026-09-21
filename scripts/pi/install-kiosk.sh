#!/usr/bin/env bash
# Installs only this user's launcher and autostart entry; preserves other entries.
set -euo pipefail
if [[ $(uname -s) != Linux || ${EUID} -eq 0 ]]; then
  echo 'Kör utan sudo på Pi:n, som den användare som loggar in på skrivbordet.' >&2
  exit 1
fi
command -v chromium >/dev/null
command -v curl >/dev/null
command -v flock >/dev/null
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/.local/bin" "$HOME/.config/labwc" "$HOME/.local/state/weather-station"
install -m 755 "$script_dir/kiosk.sh" "$HOME/.local/bin/weather-station-kiosk"
autostart="$HOME/.config/labwc/autostart"
# A per-user file replaces the system file: retain its desktop startup commands.
if [[ ! -e "$autostart" && -f /etc/xdg/labwc/autostart ]]; then
  cp /etc/xdg/labwc/autostart "$autostart"
fi
touch "$autostart"
if ! grep -Fq '# weather-station kiosk' "$autostart"; then
  cp "$autostart" "$autostart.before-weather-station"
  cat >> "$autostart" <<'AUTOSTART'

# weather-station kiosk
"$HOME/.local/bin/weather-station-kiosk" >> "$HOME/.local/state/weather-station/kiosk.log" 2>&1 &
AUTOSTART
fi
echo 'Kioskstart installerad. Aktivera skrivbordets autoinloggning och starta om när du är redo.'
