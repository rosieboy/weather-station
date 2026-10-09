#!/usr/bin/env bash
# Configure this specific USB device without formatting or deleting existing files.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Kör med sudo på Pi:n.' >&2; exit 1; }
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for executable in docker python3 tar gzip sha256sum findmnt mount umount udevadm; do
  command -v "$executable" >/dev/null
done
[[ $(blkid -s TYPE -o value /dev/disk/by-uuid/66CD-AEC1) == exfat ]] || {
  echo 'Förväntat USB-minne (66CD-AEC1, exFAT) saknas.' >&2; exit 1;
}
install -d -m 755 /usr/local/lib/weather-station-backup /mnt/weatherbackup
install -d -m 700 /var/lib/weather-station-backup
install -m 644 backup.py RESTORE.md /usr/local/lib/weather-station-backup/
install -m 644 mnt-weatherbackup.mount weather-station-backup.service weather-station-backup.timer weather-station-backup-recovery.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/mnt-weatherbackup.mount /etc/systemd/system/weather-station-backup.service /etc/systemd/system/weather-station-backup.timer /etc/systemd/system/weather-station-backup-recovery.service
# Prevent desktop automount from claiming this UUID at a different path after reboot.
install -d -m 755 /etc/udev/rules.d
printf '%s\n' 'SUBSYSTEM=="block", ENV{ID_FS_UUID}=="66CD-AEC1", ENV{UDISKS_IGNORE}="1"' > /etc/udev/rules.d/99-weather-backup.rules
udevadm control --reload-rules
systemctl daemon-reload
current=$(findmnt -rn -S UUID=66CD-AEC1 -o TARGET || true)
if [[ -n "$current" && "$current" != /mnt/weatherbackup ]]; then
  [[ "$current" != *$'\n'* ]] || { echo 'USB är monterat flera gånger; avbryter.' >&2; exit 1; }
  umount -- "$current"
fi
systemctl enable weather-station-backup-recovery.service
systemctl start mnt-weatherbackup.mount
# First run must succeed before the nightly timer is enabled.
systemctl start weather-station-backup.service
systemctl enable --now weather-station-backup.timer
systemctl list-timers weather-station-backup.timer --no-pager
cat /var/lib/weather-station-backup/last-success.json
