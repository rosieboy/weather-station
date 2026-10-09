"""Safety checks without Docker, root or writes to the real backup device."""
import importlib.util
from pathlib import Path
import subprocess
import shutil
import tarfile
import io
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def test_retention_keeps_fourteen_complete_sets_and_unrelated_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for day in range(1, 17):
                p = root / f'weather-station-202609{day:02}T030000Z.tar.gz'
                p.write_text('archive')
                p.with_name(p.name + '.sha256').write_text('hash')
            incomplete = root / 'weather-station-20260801T030000Z.tar.gz'
            incomplete.touch()
            unrelated = root / 'user-document.docx'
            unrelated.touch()
            backup.prune(root)
            self.assertFalse((root / 'weather-station-20260901T030000Z.tar.gz').exists())
            self.assertTrue((root / 'weather-station-20260903T030000Z.tar.gz').exists())
            self.assertEqual(len(list(root.glob('*.sha256'))), 14)
            self.assertTrue(incomplete.exists())
            self.assertTrue(unrelated.exists())

    def test_absent_or_wrong_usb_refuses_before_any_container_changes(self):
        with patch.object(Path, 'is_mount', return_value=False), patch.object(backup, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'not mounted'):
                backup.backup()
            run.assert_not_called()
        with patch.object(Path, 'is_mount', return_value=True), patch.object(backup, 'output', return_value='WRONG'), patch.object(backup, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'Wrong backup device'):
                backup.backup()
            run.assert_not_called()

    @unittest.skipUnless(shutil.which('sha256sum'), 'Linux checksum command required')
    def test_archive_roundtrip_and_restart_before_compression(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            home, state, usb, volume = [root / p for p in ('home', 'state', 'usb', 'volume')]
            for path in (home / 'home-assistant/data/homeassistant', home / 'home-assistant/data/matter-server', home / 'weather-station', state, usb, volume):
                path.mkdir(parents=True, exist_ok=True)
            (home / 'weather-station/.env').write_text('fixture-private-configuration')
            (volume / 'device-health.json').write_text('{"fixture": true}')
            items = [{'Id': str(i), 'State': {'Running': i != 1}, 'Name': str(i),
                      'Config': {'Image': 'fixture'}, 'Mounts': []} for i in range(3)]
            items[-1]['Mounts'] = [{'Destination': '/app/data', 'Type': 'volume',
                                   'Source': str(volume), 'Name': 'fixture-volume'}]
            actual_run = subprocess.run
            commands = []
            def invoke(args, **kwargs):
                commands.append(tuple(args))
                if args[0] in ('docker', 'systemctl'):
                    return subprocess.CompletedProcess(args, 3 if 'is-active' in args else 0)
                return actual_run(args, **kwargs)
            with patch.object(backup, 'SYSTEM_SOURCES', []), patch.object(backup, 'HOME', home), patch.object(backup, 'STATE', state), patch.object(backup, 'PENDING', state / 'pending.json'), patch.object(backup, 'USB', usb), patch.object(backup, 'check_usb'), patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=10 * 1024**3)), patch.object(backup, 'containers', return_value=items), patch.object(backup, 'output', return_value='fixture-commit'), patch.object(backup.subprocess, 'run', side_effect=invoke):
                backup.backup()
            archives = list((usb / 'weather-station-backups').glob('*.tar.gz'))
            self.assertEqual(len(archives), 1)
            self.assertTrue((state / 'last-success.json').exists())
            self.assertFalse((state / 'pending.json').exists())
            self.assertIn(('docker', 'start', '0'), commands)
            self.assertNotIn(('docker', 'start', '1'), commands)
            compressed = next(i for i, cmd in enumerate(commands) if cmd[0] == 'tar' and '--gzip' in cmd)
            self.assertLess(commands.index(('docker', 'start', '2')), compressed)
            with tarfile.open(archives[0]) as outer:
                data = outer.extractfile('./dashboard-data.tar').read()
                with tarfile.open(fileobj=io.BytesIO(data)) as inner:
                    self.assertEqual(inner.extractfile('./device-health.json').read(), b'{"fixture": true}')
                files = outer.extractfile('./files.tar').read()
                with tarfile.open(fileobj=io.BytesIO(files)) as inner:
                    self.assertEqual(inner.extractfile(str(home).lstrip('/') + '/weather-station/.env').read(), b'fixture-private-configuration')

    def test_recovery_attempts_every_container_and_restores_timer_after_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            pending = Path(directory) / 'pending.json'
            backup.atomic_json(pending, {'containers': ['one', 'two'], 'health_timer': True})
            def invoke(*args, **kwargs):
                if args == ('docker', 'start', 'one'):
                    raise subprocess.CalledProcessError(1, args)
            with patch.object(backup, 'PENDING', pending), patch.object(backup, 'run', side_effect=invoke) as run:
                with self.assertRaisesRegex(RuntimeError, 'restart all'):
                    backup.recover()
                self.assertEqual(run.call_count, 3)
                self.assertTrue(pending.exists())
            with patch.object(backup, 'PENDING', pending), patch.object(backup, 'run') as run:
                backup.recover()
                self.assertFalse(pending.exists())
                self.assertEqual(run.call_count, 3)


if __name__ == '__main__':
    unittest.main()
