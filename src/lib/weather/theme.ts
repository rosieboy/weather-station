const stockholmHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  hourCycle: 'h23'
});

export type ThemeMode = 'day' | 'night' | 'ambient' | 'auto';
export type DisplayTheme = 'day' | 'night' | 'deep-ambient';

const themeOrder: ThemeMode[] = ['day', 'night', 'ambient', 'auto'];

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return themeOrder[(themeOrder.indexOf(mode) + 1) % themeOrder.length];
}

export function isDeepAmbient(now: number): boolean {
  const hour = Number(stockholmHour.format(now));
  return hour >= 23 || hour < 8;
}

export function resolveTheme(
  mode: ThemeMode,
  now: number,
  daylight: boolean | null
): DisplayTheme {
  if (mode === 'day') return 'day';
  if (mode === 'night') return 'night';
  if (mode === 'ambient') return 'deep-ambient';
  return isDeepAmbient(now)
    ? 'deep-ambient'
    : daylight === false
      ? 'night'
      : 'day';
}
