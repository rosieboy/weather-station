#!/usr/bin/env python3
"""Read-only Pi health checks. No credentials, restarts or external requests."""
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

STATE = Path(os.environ.get('STATE_DIRECTORY', '/var/lib/weather-station-health'))
CONTAINERS = ('weather-station-weather-station-1', 'home-assistant-homeassistant-1',
              'home-assistant-matter-server-1')


def transition(previous, failed):
    count = previous.get('failures', 0) + 1 if failed else 0
    active = count >= 3
    event = 'ALERT' if active and not previous.get('active') else (
        'RECOVERED' if not failed and previous.get('active') else None)
    return {'failures': count, 'active': active}, event


def command(*args):
    return subprocess.check_output(args, timeout=12, text=True, stderr=subprocess.DEVNULL).strip()


def http(url):
    with urllib.request.urlopen(url, timeout=8) as response:
        if response.status != 200:
            raise ValueError('HTTP not 200')


def snapshot():
    # A bounded curl invocation also bounds an SSE endpoint sending heartbeats forever.
    result = subprocess.run(['curl', '--silent', '--fail', '--max-time', '8',
                             'http://127.0.0.1:3000/api/events'],
                            capture_output=True, text=True, timeout=12)
    if result.returncode not in (0, 28):
        raise ValueError('SSE connection failed')
    for line in result.stdout.splitlines():
        if line.startswith('data:'):
            data = json.loads(line[5:])
            if 'outdoor' not in data or 'rooms' not in data:
                raise ValueError('Invalid snapshot')
            return data
    raise ValueError('No snapshot within 8 seconds')


def main():
    STATE.mkdir(parents=True, exist_ok=True)
    path = STATE / 'status.json'
    try:
        old = json.loads(path.read_text())
    except (FileNotFoundError, ValueError):
        old = {}
    results, metrics = {}, {}

    def check(name, action):
        try:
            message = action()
            results[name] = message or None
        except Exception as exc:
            results[name] = 'Check failed: ' + type(exc).__name__

    def disk():
        total, used, free = shutil.disk_usage('/')
        metrics['disk_used_percent'] = round(100 * used / total, 1)
        return 'Disk usage >=85% or free space <3 GiB' if used / total >= .85 or free < 3 * 2**30 else None

    def memory():
        mem = {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
        metrics['memory_available_mib'] = round(mem['MemAvailable'] / 1024)
        return 'Available memory <300 MiB' if mem['MemAvailable'] < 300 * 1024 else None

    def temperature():
        value = int(Path('/sys/class/thermal/thermal_zone0/temp').read_text()) / 1000
        metrics['temperature_c'] = value
        return 'CPU temperature >=80 C' if value >= 80 else None

    def power():
        value = int(command('/usr/bin/vcgencmd', 'get_throttled').split('=')[1], 16)
        metrics['throttled_flags'] = hex(value)
        # Sticky historical flags are recorded, not treated as a current fault.
        return 'Current undervoltage, frequency cap or throttling' if value & 0xf else None

    check('disk', disk)
    check('memory', memory)
    check('temperature', temperature)
    check('power', power)
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    for name in CONTAINERS:
        def container(name=name):
            item = json.loads(command('docker', 'inspect', name))[0]
            state = item['State']
            previous = old.get('metrics', {}).get(name, {})
            metrics[name] = {'id': item['Id'], 'restarts': item['RestartCount']}
            if not state['Running'] or state.get('Health', {}).get('Status') in ('unhealthy', 'starting'):
                return 'Container stopped or not healthy'
            if old.get('boot_id') == boot and previous.get('id') == item['Id'] and item['RestartCount'] > previous.get('restarts', 0):
                return 'Container restarted unexpectedly since previous check'
        check('container:' + name, container)
    check('ha_http', lambda: http('http://127.0.0.1/'))
    check('dashboard_http', lambda: http('http://127.0.0.1:3000/'))
    check('matter_http', lambda: http('http://127.0.0.1:5580/'))

    def sensors():
        data = snapshot()
        if data.get('error') or data.get('home', {}).get('error'):
            return 'Dashboard reports HA connection failure'
        readings = [data['outdoor'], *data['rooms']]
        expected = {'outdoor', 'balcony', 'living-room', 'bedroom'}
        present = set()
        for reading in readings:
            if reading.get('id') not in expected:
                continue
            present.add(reading['id'])
            for field in ('temperature', 'humidity'):
                value = reading.get(field)
                if not isinstance(value, (int, float)) or not math.isfinite(value):
                    return 'Missing reading: ' + reading['id'] + '/' + field
        if present != expected:
            return 'Expected sensor missing'
        # Unchanged values/last_updated are not an outage: HA emits state changes.
    check('sensor_data', sensors)
    checks = {}
    for name, problem in results.items():
        state, event = transition(old.get('checks', {}).get(name, {}), bool(problem))
        state['problem'] = problem
        checks[name] = state
        if event:
            print(f'{event} {name}: {problem or "healthy again"}', flush=True)
    report = {'checked_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'boot_id': boot, 'checks': checks, 'metrics': metrics}
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(report, indent=2) + '\n')
    tmp.replace(path)
    active = sum(x['active'] for x in checks.values())
    pending = sum(bool(x['problem']) and not x['active'] for x in checks.values())
    print(f'Health: {active} active, {pending} pending; metrics={json.dumps(metrics)}')
    return 1 if active else 0


if __name__ == '__main__':
    raise SystemExit(main())
