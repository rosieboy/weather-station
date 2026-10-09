#!/usr/bin/env python3
"""Restart only the current user's dashboard kiosk, including from SSH."""
import argparse
import os
from pathlib import Path
import signal
import shlex
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check without restarting')
    args = parser.parse_args()
    if sys.platform != 'linux' or os.geteuid() == 0:
        raise SystemExit('Kör som skrivbordsanvändaren på Pi:n, utan sudo.')
    home = Path.home()
    profile = str(home / '.local/share/weather-station-chromium')
    launcher = home / '.local/bin/weather-station-kiosk'
    if not os.access(launcher, os.X_OK):
        raise SystemExit('Kioskstartaren saknas. Kör bash scripts/pi/install-kiosk.sh först.')
    matches = []
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            if entry.stat().st_uid != os.getuid():
                continue
            argv = (entry / 'cmdline').read_bytes().split(b'\0')
            argv = [item.decode() for item in argv if item]
            # Chromium may rewrite its process title as one space-separated argument.
            if len(argv) == 1:
                argv = shlex.split(argv[0])
            if (argv and Path(argv[0]).name in ('chromium', 'chromium-browser')
                    and '--kiosk' in argv
                    and '--user-data-dir=' + profile in argv
                    and not any(item.startswith('--type=') for item in argv)):
                matches.append(entry)
        except (OSError, UnicodeError, ValueError):
            continue
    if len(matches) != 1:
        raise SystemExit(f'Hittade {len(matches)} kioskprocesser; förväntade en. '
                         'Ingen process ändrad. Starta kiosken från Pi-skrivbordet om den inte körs.')
    entry = matches[0]
    environment = dict(os.environ)
    for item in (entry / 'environ').read_bytes().split(b'\0'):
        if b'=' in item:
            key, value = item.split(b'=', 1)
            environment[key.decode()] = value.decode()
    if args.check:
        print(f'Kiosk PID {entry.name}; startare hittad och processmiljö läst. Ingen omstart gjord.')
        return
    os.kill(int(entry.name), signal.SIGTERM)
    for _ in range(100):
        if not entry.exists():
            break
        time.sleep(0.1)
    else:
        raise SystemExit('Kiosken avslutades inte inom tio sekunder. Ingen ny instans startad.')
    log = home / '.local/state/weather-station/kiosk.log'
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open('ab') as output:
        process = subprocess.Popen([str(launcher)], env=environment,
                                   start_new_session=True, stdin=subprocess.DEVNULL,
                                   stdout=output, stderr=subprocess.STDOUT)
    time.sleep(3)
    if process.poll() is not None:
        raise SystemExit(f'Startaren avslutades ({process.returncode}). Kontrollera {log}.')
    print(f'Kiosken startad igen, PID {process.pid}. Kontrollera bilden på Pi-skärmen.')


if __name__ == '__main__':
    main()
