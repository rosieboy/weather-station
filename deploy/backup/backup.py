#!/usr/bin/env python3
"""Cold data backup for this Pi. Run as root via the supplied systemd service."""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

USB_UUID = '66CD-AEC1'
USB = Path('/mnt/weatherbackup')
STATE = Path('/var/lib/weather-station-backup')
PENDING = STATE / 'stopped-containers.json'
HOME = Path('/home/anders')
SYSTEM_SOURCES = [Path('/etc/weather-station-health'),
                  Path('/usr/local/lib/weather-station-health'),
                  Path('/etc/systemd/system/weather-station-health.service'),
                  Path('/etc/systemd/system/weather-station-health.timer')]


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def output(*args):
    return subprocess.check_output(args, text=True).strip()


def atomic_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def recover():
    if not PENDING.exists():
        return
    record = json.loads(PENDING.read_text())
    errors = []
    for cid in record['containers']:
        try:
            run('docker', 'start', cid, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            errors.append(cid)
    if record['health_timer']:
        try:
            run('systemctl', 'start', 'weather-station-health.timer')
        except subprocess.CalledProcessError:
            errors.append('health timer')
    if errors:
        raise RuntimeError('Could not restart all containers; recovery record retained')
    PENDING.unlink()
    print('Previously running containers restarted.', flush=True)


def containers():
    ids = []
    for directory, services in ((HOME / 'home-assistant', ['homeassistant', 'matter-server']),
                                (HOME / 'weather-station', ['weather-station'])):
        for service in services:
            cid = output('docker', 'compose', '--project-directory', str(directory),
                         'ps', '-a', '-q', service)
            if not cid or '\n' in cid:
                raise RuntimeError('Expected one installed container for ' + service)
            ids.append(cid)
    return json.loads(output('docker', 'inspect', *ids))


def check_usb():
    if not USB.is_mount():
        raise RuntimeError('Backup USB is not mounted; will not write to SD card')
    uuid = output('findmnt', '-n', '-o', 'UUID', '--target', str(USB))
    if uuid != USB_UUID:
        raise RuntimeError('Wrong backup device UUID; no backup written')
    if shutil.disk_usage(USB).free < 2 * 1024**3:
        raise RuntimeError('Less than 2 GiB free on USB; old backups retained')


def prune(directory, keep=14):
    # Only our completed sets; unrelated files and incomplete backups are untouched.
    completed = sorted(p for p in directory.glob('weather-station-????????T??????Z.tar.gz')
                       if p.with_name(p.name + '.sha256').is_file())
    for path in completed[:-keep]:
        path.unlink()
        path.with_name(path.name + '.sha256').unlink()


def backup():
    check_usb()
    recover()
    info = containers()
    dashboard = info[-1]
    mounts = [m for m in dashboard['Mounts'] if m['Destination'] == '/app/data']
    if len(mounts) != 1 or mounts[0]['Type'] != 'volume':
        raise RuntimeError('Expected dashboard data Docker volume')
    volume = Path(mounts[0]['Source'])
    if not volume.is_dir():
        raise RuntimeError('Dashboard volume missing')
    if shutil.disk_usage(STATE).free < 3 * 1024**3:
        raise RuntimeError('Less than 3 GiB staging space on SD card')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = USB / 'weather-station-backups'
    destination.mkdir(exist_ok=True)
    archive = destination / ('weather-station-' + stamp + '.tar.gz')
    if archive.exists():
        raise RuntimeError('Backup name already exists')
    running = [c['Id'] for c in info if c['State']['Running']]
    sources = [HOME / 'home-assistant', HOME / 'weather-station',
               HOME / '.config/labwc', HOME / '.local/bin/weather-station-kiosk'] + SYSTEM_SOURCES
    required = [HOME / 'home-assistant/data/homeassistant',
                HOME / 'home-assistant/data/matter-server', HOME / 'weather-station/.env']
    if not all(p.exists() for p in required):
        raise RuntimeError('Required source data missing')
    manifest = {'created_at': datetime.now(timezone.utc).isoformat(), 'usb_uuid': USB_UUID,
                'git_commit': output('git', '-C', str(HOME / 'weather-station'), 'rev-parse', 'HEAD'),
                'containers': [{'name': c['Name'], 'image': c['Config']['Image'],
                                'was_running': c['State']['Running']} for c in info],
                'dashboard_volume': mounts[0]['Name'],
                'sources': [str(p) for p in sources if p.exists()]}
    temporary = archive.with_name(archive.name + '.partial')
    health_timer = subprocess.run(['systemctl', 'is-active', '--quiet',
                                   'weather-station-health.timer']).returncode == 0
    with tempfile.TemporaryDirectory(prefix='staging-', dir=STATE) as temp:
        staging = Path(temp)
        # Also recover the health timer when systemd terminates this process.
        atomic_json(PENDING, {'containers': running, 'health_timer': health_timer})
        try:
            if health_timer:
                run('systemctl', 'stop', 'weather-station-health.timer')
                run('systemctl', 'stop', 'weather-station-health.service')
            if running:
                run('docker', 'stop', '--time', '60', *running, stdout=subprocess.DEVNULL)
            exclusions = ['home/anders/home-assistant/data/homeassistant/backups',
                          'home/anders/weather-station/.git',
                          'home/anders/weather-station/node_modules',
                          'home/anders/weather-station/.svelte-kit',
                          'home/anders/weather-station/build']
            run('tar', '--create', '--file', str(staging / 'files.tar'), '--numeric-owner',
                *['--exclude=' + p for p in exclusions], '-C', '/',
                *[str(p).lstrip('/') for p in sources if p.exists()])
            run('tar', '--create', '--file', str(staging / 'dashboard-data.tar'),
                '--numeric-owner', '-C', str(volume), '.')
        finally:
            recover()
        # Services are back before compression, USB write and archive verification.
        atomic_json(staging / 'manifest.json', manifest)
        shutil.copyfile(Path(__file__).with_name('RESTORE.md'), staging / 'RESTORE.md')
        check_usb()
        try:
            run('tar', '--create', '--gzip', '--file', str(temporary), '-C', str(staging), '.')
            run('gzip', '--test', str(temporary))
            run('tar', '--list', '--gzip', '--file', str(temporary), stdout=subprocess.DEVNULL)
            for member in ('files.tar', 'dashboard-data.tar'):
                # Verify both nested tar archives, too.
                run('tar', '--list', '--file', str(staging / member), stdout=subprocess.DEVNULL)
            with temporary.open('rb') as f:
                hasher = hashlib.sha256()
                for block in iter(lambda: f.read(1024 * 1024), b''):
                    hasher.update(block)
                digest = hasher.hexdigest()
            with temporary.open('rb') as f:
                os.fsync(f.fileno())
            os.replace(temporary, archive)
            checksum = archive.with_name(archive.name + '.sha256')
            checksum.write_text(digest + '  ' + archive.name + '\n')
            with checksum.open('rb') as f:
                os.fsync(f.fileno())
            run('sha256sum', '--check', checksum.name, cwd=destination)
            atomic_json(STATE / 'last-success.json', {
                'created_at': manifest['created_at'], 'archive': str(archive),
                'sha256': digest, 'bytes': archive.stat().st_size})
            prune(destination)
            print('Verified backup completed: ' + str(archive), flush=True)
        finally:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recover', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo on the Pi')
    os.umask(0o077)
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (STATE / 'backup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.recover:
            recover()
        else:
            backup()


if __name__ == '__main__':
    main()
