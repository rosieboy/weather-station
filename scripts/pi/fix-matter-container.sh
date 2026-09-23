#!/usr/bin/env bash
# Run on the Pi after restoring HA OS data to Home Assistant Container.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then
  echo 'Kör med sudo på Pi:n.' >&2
  exit 1
fi
cd /home/anders/home-assistant
config=data/homeassistant/.storage/core.config_entries
test -f "$config"
docker compose stop homeassistant
cp -p "$config" "$config.before-container-$(date +%Y%m%d-%H%M%S)"
python3 - "$config" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
d = json.loads(p.read_text())
entries = [e for e in d['data']['entries'] if e['domain'] == 'matter']
if len(entries) != 1:
    raise SystemExit('Förväntade exakt en Matter-integration. HA lämnas stoppad för kontroll.')
e = entries[0]
e['data'].update(url='ws://127.0.0.1:5580/ws', use_addon=False, integration_created_addon=False)
p.write_text(json.dumps(d))
print('Matter använder nu den fristående servern.')
PY
docker compose up -d
