/** Explicit browser origins only. This is CSRF protection, not authentication. */
export function allowedControlOrigin(
  origin: string | null,
  canonicalOrigin: string,
  extraOrigins = ''
): boolean {
  if (!origin || origin === 'null') return false;
  const allowed = [canonicalOrigin, ...extraOrigins.split(',')];
  return allowed.some((entry) => {
    try {
      const url = new URL(entry.trim());
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        url.origin === origin
      );
    } catch {
      return false;
    }
  });
}
