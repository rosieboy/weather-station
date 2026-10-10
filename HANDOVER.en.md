# Developer handover to ChatGPT/Codex

[Svenska](HANDOVER.md) · [English documentation](README.en.md)

Updated **2026-10-10**. SvelteKit/Svelte 5 dashboard for a Raspberry Pi kiosk at
**1280 × 720**, with Weather, Rooms, Audio, Calendar, Car and responsive mobile views.
Read [README.en.md](README.en.md) for architecture/configuration and
[DRIFT.en.md](DRIFT.en.md) for verified manual commands. Historical review findings
in [COPILOT.md](COPILOT.md) were not resolved merely by UI changes.

## Code responsibilities

- `src/routes/+page.svelte`: navigation, Weather, forecast toggle, SSE, clock,
  idle return and `<html data-theme>`.
- `src/lib/components/RoomsView.svelte`: separate Rooms cards/dialogs/controls.
  These are distinct from sensor cards in the Weather view.
- `src/lib/components/AudioView.svelte`: Sonos cards, volume, sources and grouping.
- `src/lib/components/CarView.svelte`, `/api/car`, `car-model.ts`: Polestar view
  and normalized data from the existing HA stream.
- `NavIcon.svelte`: five decorative SVG icons using `currentColor`; menu buttons
  carry Swedish aria-label/title and active aria-current, with ≥48 × 48 px targets.
- `src/app.css`: view/theme tokens and responsive rules. Late `deep-ambient`
  rules override older card colors. The shared ambient rule resets shadows;
  new room/audio rules need enough specificity.
- `src/lib/weather/theme.ts`, `tests/theme.test.mjs`: theme timing and Swedish
  daylight-saving boundary tests.
- `src/lib/server/ha-stream.ts`: shared HA transport; model files validate controls.

## UI behavior and themes

Weather highlights outdoor temperature with secondary readings, room curves and
an entire forecast row toggling days/hours. Visible sensor/forecast timestamps
and audio playback-time rows were removed. Weather sensor cards align temperature
and humidity; the hidden humidity label remains for screen readers. Room dialogs
have larger switches/dimmers and fixed feedback space. Audio has larger transport
buttons/title/artist and a filled 24 px volume track; commands send on release.

Day/Night have view-specific palettes. `deep-ambient` uses black and muted red,
including dialogs/controls. Theme selection persists in the browser, cycling
Day → Night → Ambient → Auto. Manual modes stay fixed. Auto chooses Ambient
**23:00–07:59 Europe/Stockholm**, otherwise solar Day/Night. CSS values are `day`,
`night`, `deep-ambient`. Clock updates every second using the server offset.
Idle for five minutes returns to Weather from any view and closes dialogs.
Multi-day calendar events appear on each overlapping day.

Car uses `static/polestar.jpg` and fixed `sensor.polestar_*`/`binary_sensor.polestar_*`
fields from HA's existing stream. Visible car view fetches that cache every
30 seconds, with no extra Polestar calls. Missing values are dashes. Battery,
security, health and mileage each use their own reporting timestamp and mark
values stale after a day. Consumption, trip meter, service interval and five
health warnings are included. Unknown values block all-closed-and-locked status;
HA lock sensor `on` means unlocked. No car commands exist.

Day/Ambient photograph treatment improves car visibility; Night is preserved.
Security/health panels have translucent backgrounds and blur; text is fully
opaque with ≥4.5:1 normal-text contrast under conservative backdrop calculations.

Polestar Data Portal 0.3.0 is manually installed in HA outside this repo.
The current credential expires 2026-12-16. Secrets remain in HA.

## Installation and verification

Pi repository: `~/weather-station`; HA/Matter: `~/home-assistant`.
Mac SSH key: `~/.ssh/id_raspberry`. `scripts/pi/restart-kiosk.py` restarts using
the running kiosk's desktop environment, without sudo; `--check` only inspects.
Deploy commands are in [DRIFT.en.md](DRIFT.en.md).

Expanded car functionality passed `npm test` (49 tests), `npm run check` and
`npm run build`; user confirmed the physical kiosk after restart. Later visual
changes passed check/build and browser checks. Do not send live HA/Sonos control
commands just to test UI; mock control APIs when needed.

## USB backup

Installed 2026-10-10. `deploy/backup` contains installer, UUID 66CD-AEC1 systemd
mount, nightly 03:00 timer, archive script and restoration instructions.
Temporarily pauses three containers for consistent local archives, resumes them,
then verifies the archive on exFAT before retention of 14 sets. Existing USB files
are preserved. First production archive (27.6 MiB) verified; both timers active
and all containers resumed after about one minute. Status:
`/var/lib/weather-station-backup/last-success.json`. Full disaster restoration to
a new SD card remains deferred. See [backup](deploy/backup/README.en.md) and
[restore](deploy/backup/RESTORE.en.md).

## Documentation maintenance

Keep Swedish `.md` and English `.en.md` operational guides aligned in the same
commit. Preserve command paths, entity IDs and Swedish UI names in English text.
Historical Gemini/Copilot conversations remain in their original language.
Documentation language does not change the dashboard language.

## Restored pressure display

Weather again shows pressure and the three-hour trend. Four secondary readings
use two columns and two rows in the kiosk. Missing history shows Trycktrend saknas.
Weather screenshots and both README versions are updated.

The car photo now uses fixed background layers across the viewport, including
behind navigation. `.dashboard.view-car` isolates stacking; `.car-view` is
transparent. View-specific menu surfaces protect readability. Mobile content
stacks above the photo. Check/build, view switching and mobile width verified.
