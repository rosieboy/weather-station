export type MotionState = 'on' | 'off' | 'unknown';

/** Fail awake: only a healthy, explicitly clear sensor may put the kiosk to sleep. */
export function createPresenceController(
  awakeMs: number,
  onSleep: (sleep: boolean) => void
) {
  let motion: MotionState = 'unknown';
  let deadline = Date.now() + awakeMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  function check() {
    clearTimeout(timer);
    if (stopped) return;
    const remaining = deadline - Date.now();
    const sleep = motion === 'off' && remaining <= 0;
    onSleep(sleep);
    if (motion === 'off' && !sleep) timer = setTimeout(check, remaining);
  }
  return {
    update(next: MotionState) {
      if (stopped) return;
      if (next !== motion) deadline = Date.now() + awakeMs;
      motion = next;
      check();
    },
    wake() {
      if (stopped) return;
      deadline = Date.now() + awakeMs;
      check();
    },
    check,
    stop() {
      stopped = true;
      clearTimeout(timer);
    }
  };
}
