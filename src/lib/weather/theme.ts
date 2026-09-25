const stockholmHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  hourCycle: 'h23'
});

export function isDeepAmbient(now: number): boolean {
  const hour = Number(stockholmHour.format(now));
  return hour >= 23 || hour < 8;
}
