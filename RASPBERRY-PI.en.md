# Weather station on Raspberry Pi

[Svenska](RASPBERRY-PI.md) · [English documentation](README.en.md)

Installed and verified 2026-09-23: Raspberry Pi 5, Raspberry Pi OS 64-bit desktop
(Wayland/labwc), Docker Engine and Chromium kiosk. For updates, kiosk restart and
troubleshooting, see [Manual operation](DRIFT.en.md).

## Current operation

Sensors/DIRIGERA → Matter on Pi → HA Container on Pi → dashboard → Chromium.
HA handles Sonos, Apple TV and weather integrations. Dashboard:
<http://vaderstation.local:3000/>; HA: <http://vaderstation.local/> (port 80).
The Mac HA VM is stopped. [Migration history](HA-MIGRATION.en.md) records fixes
and verification. HA/Matter runs in `~/home-assistant`; dashboard in
`~/weather-station`. The following steps are for reinstalling. Do not write HA OS
to the Pi system disk: it would replace the desktop and kiosk.

## Prepare the SD card on the Mac

Use [official Raspberry Pi Imager](https://www.raspberrypi.com/software/).
Choose Raspberry Pi 5 and **Raspberry Pi OS (64-bit) with desktop**. The ordinary
desktop edition is sufficient; do not select Lite, Full or the PC/Mac Raspberry Pi
Desktop edition. The documented installation uses Debian 13 Trixie; use Imager's
recommended stable 64-bit desktop edition and adapt repository instructions if
its Debian codename differs. The preparation notes recorded release 2026-09-15;
this is historical, not a claim about today's newest OS.

| Setting                  | Installation choice                                       |
| ------------------------ | --------------------------------------------------------- |
| Hostname                 | `vaderstation`                                            |
| User                     | `anders`                                                  |
| Password                 | Choose in Imager; never store in Git                      |
| Time zone                | Europe/Stockholm                                          |
| Keyboard / Wi-Fi country | Sweden / SE                                               |
| Network                  | Ethernet if practical, otherwise home Wi-Fi               |
| SSH                      | Enable, preferably with the Mac's existing public SSH key |

Use at least a 32 GB microSD card; 1 GB is insufficient. Writing erases the
selected card. Check device name/size, allow verification to finish and eject it.
During the original preparation no image was downloaded by the agent and no disk
was modified; Imager downloads/verifies the image when writing.

## Assembly and first boot

With power disconnected, install cooling/display according to their manuals.
Insert the prepared card, connect network and optional display/keyboard. Pi 5
uses micro-HDMI; connect the touch display ribbon according to its own manual.
Connect the intended Pi power supply, wait for first boot, check desktop/network.
From the Mac terminal:

```sh
ssh anders@vaderstation.local
```

If `.local` fails, use the IP from the router. Verify the SSH host key on first
connection and substitute your user if different. **Remaining installation
commands run on the Pi**, over SSH or in its terminal.

```sh
uname -m
cat /etc/os-release
sudo apt update
sudo apt full-upgrade
sudo apt install git curl ca-certificates chromium
sudo timedatectl set-timezone Europe/Stockholm
timedatectl status
```

Architecture should be `aarch64`, package architecture `arm64`. Reboot after OS
updates if needed, then reconnect.

## Docker Engine

Use Docker Engine; follow [Docker's Debian instructions](https://docs.docker.com/engine/install/debian/).
For the documented 64-bit installation:

```sh
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf '%s\n' "$VERSION_CODENAME"
dpkg --print-architecture
```

Continue with the repository configuration below only when the values are
`trixie` and `arm64`; adapt to another supported OS release if needed.

```sh
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: arm64
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

These instructions use `sudo docker`; membership in the Docker group is unnecessary.

## Fetch the project and private configuration

On the Pi:

```sh
git clone https://github.com/rosieboy/weather-station.git
cd ~/weather-station
```

Use the normal GitHub/SSH login flow if required; never put a token in the clone URL.
Copy the working `.env` **from the Mac terminal**:

```sh
scp '/Users/andersrosen/Documents/Codex/2026-09-13/referenced-chatgpt-conversation-this-is-an/weather-station/.env' anders@vaderstation.local:weather-station/.env
```

Back on the Pi:

```sh
cd ~/weather-station
chmod 600 .env
nano .env
```

Keep existing sensor/Sonos IDs and HA token. Set:

```dotenv
ORIGIN=http://localhost:3000
CONTROL_ALLOWED_ORIGINS=http://vaderstation.local:3000
```

Also add `http://PI-IP:3000`, comma-separated, if browsers access by IP; substitute
the actual address. Allowed origins permit clients visiting those server addresses,
not just a particular iPad. The old Mac origin need not remain.
`HOME_ASSISTANT_URL` must point to HA's reachable LAN address, currently
`http://192.168.0.130` (port 80). Do not use `localhost` inside the dashboard
container. The old Mac VM stays stopped. `.env` contains secrets and is Git-ignored.
Port 3000 is available without login on the home LAN; no router internet port is opened.

## Start the dashboard

In the Pi project directory:

```sh
sudo docker compose up -d --build
sudo docker compose ps
curl --fail http://localhost:3000/ >/dev/null
```

The first build may take minutes. Docker builds ARM64; Node/npm are not required
on the Pi host. Test the Pi URL from Mac/iPad and localhost in Pi Chromium.
Check real sensor values before enabling kiosk launch. `restart: unless-stopped`
restarts the app after reboot unless explicitly stopped. After `.env` changes,
`sudo docker compose up -d` recreates the container with new values.

## Display and automatic full screen

Use desktop display settings for landscape orientation and 1280 × 720 on this
7-inch display; verify touch after rotation. Do not hardcode old X11 commands.
In `sudo raspi-config`, select **Desktop Autologin** and disable **Screen Blanking**.
Menu names may vary. Local desktop opens without a password; SSH authentication
is separate. Install the launcher without sudo as the desktop user:

```sh
cd ~/weather-station
bash scripts/pi/install-kiosk.sh
```

The installer saves existing labwc autostart and adds one entry. The launcher
waits for app HTTP and opens Chromium full screen with a separate profile,
preserving themes and avoiding duplicate kiosk instances. `?kiosk=1` makes met.no
attribution non-clickable; normal browser visits retain the link.

The profile uses `--password-store=basic` to avoid Unlock Keyring during autologin.
Use it only for the dashboard and save no passwords: this storage lacks keyring
encryption. Pi password/other keyrings are unaffected; the HA token stays on the
server. See [Chromium password storage](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/password_storage.md).
For an older launcher showing a keyring prompt, update Git and rerun installation,
then reboot/check. A persistent white screen needs separate kiosk-log investigation.

Reboot and check automatic display. The launcher does not restart Chromium after
manual close/crash; log in again or run `~/.local/bin/weather-station-kiosk` in the
Pi desktop terminal. Alt+F4 exits the kiosk. To disable autostart, remove the two
lines beneath `# weather-station kiosk` in `~/.config/labwc/autostart`, preserving
other entries.

**Ctrl+0** resets zoom to 100%; restarting preserves saved zoom. Focus the kiosk
first, including when using Raspberry Connect. Ctrl+W closes an externally opened
tab; Alt+Left returns if a link replaced the current page. For remote reload/restart,
use [DRIFT.en.md](DRIFT.en.md).

## Hardware verification and troubleshooting

Check 64-bit desktop and NTP time, real temperatures/weather, external automation
updates, Kitchen island dimming feedback, iPad controls, display/touch orientation,
all view layouts, animation load and HA reconnection. App/kiosk return after reboot
has been confirmed by the user; the original checklist's other items were not
all marked complete.

On the Pi:

```sh
sudo docker compose logs --tail 100
cat ~/.local/state/weather-station/kiosk.log
free -h
vcgencmd measure_temp
vcgencmd get_throttled
```

For an unauthorized-origin error, check exact protocol, host/IP and port in
`CONTROL_ALLOWED_ORIGINS`, then recreate the container. For sensor connection
failure, check `cd ~/home-assistant && sudo docker compose ps` and the HA URL.
The current `.env` uses `HOME_ASSISTANT_URL=http://192.168.0.130`.
Update with `git pull --ff-only`, then `sudo docker compose up -d --build` and reload
the kiosk. Run `sudo poweroff` and wait before unplugging power.

## Ongoing maintenance

SSH administration works while kiosk is displayed. Back up before updates.
OS: `sudo apt update`, then `sudo apt full-upgrade`, scheduling `sudo reboot` if
needed. Avoid automatic OS upgrades during migration. Dashboard updates run in
`~/weather-station`; HA/Matter maintenance is in its [guide](deploy/home-assistant/README.en.md).
Change explicit versions one service at a time and verify sensors/lights/audio.
A backup solely on the same SD card is insufficient.

The [health timer](deploy/health/README.en.md) checks resources, containers, HTTP
and sensor stream every five minutes, with local/Gmail alerts and recovery messages.
Installed 2026-09-23; Gmail verified 2026-09-24. No automatic repair.
[Nightly USB backup](deploy/backup/README.en.md) is installed as of 2026-10-10.

References: [Pi OS](https://www.raspberrypi.com/software/operating-systems/),
[Getting started](https://www.raspberrypi.com/documentation/computers/getting-started.html),
[labwc kiosk guide](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/),
[Docker on Debian](https://docs.docker.com/engine/install/debian/).
