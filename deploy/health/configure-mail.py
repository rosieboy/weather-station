#!/usr/bin/env python3
"""Interactive local credential entry. Never pass the password as a CLI argument."""
import getpass
import json
import os
from pathlib import Path

if os.geteuid() != 0:
    raise SystemExit('Kör med sudo på Pi:n.')
password = ''.join(getpass.getpass('Gmail-applösenord (visas inte): ').split())
if len(password) != 16 or not password.isascii() or not password.isalpha():
    raise SystemExit('Förväntade ett applösenord med 16 bokstäver. Ingen ändring gjord.')
os.umask(0o077)
p = Path('/etc/weather-station-health')
p.mkdir(mode=0o700, exist_ok=True)
tmp = p / 'smtp.json.tmp'
tmp.write_text(json.dumps({'sender': 'redaretorget@gmail.com',
                           'recipient': 'androsen@gmail.com', 'password': password}))
tmp.chmod(0o600)
tmp.replace(p / 'smtp.json')
print('Sparat skyddat på Pi:n. Nästa hälsokontroll skickar ett startmeddelande.')
