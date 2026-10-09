export const IDLE_RETURN_MS = 5 * 60_000;

export function startIdleReturn(document: Document, onIdle: () => void) {
  const activityEvents = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'keydown',
    'click',
    'input',
    'wheel',
    'scroll'
  ];
  let lastActivity = Date.now();
  let returned = false;
  let timer: ReturnType<typeof setTimeout>;

  function check() {
    clearTimeout(timer);
    if (returned) return;
    const remaining = IDLE_RETURN_MS - (Date.now() - lastActivity);
    if (remaining > 0) {
      timer = setTimeout(check, remaining);
    } else {
      returned = true;
      onIdle();
    }
  }

  function activity() {
    lastActivity = Date.now();
    returned = false;
    check();
  }

  function onVisible() {
    // Background tabs may suspend timers; check elapsed time on return.
    if (document.visibilityState === 'visible') check();
  }

  for (const event of activityEvents)
    document.addEventListener(event, activity, {
      capture: true,
      passive: true
    });
  document.addEventListener('visibilitychange', onVisible);
  check();

  return () => {
    clearTimeout(timer);
    for (const event of activityEvents)
      document.removeEventListener(event, activity, { capture: true });
    document.removeEventListener('visibilitychange', onVisible);
  };
}
