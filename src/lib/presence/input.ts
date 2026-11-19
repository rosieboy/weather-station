/** Capture wake gestures before delegated click/swipe handlers or hidden controls. */
export function startPresenceInput(
  target: EventTarget,
  isSleeping: () => boolean,
  wake: () => void
) {
  let blockClickUntil = 0;
  const events = [
    'pointerdown',
    'mousedown',
    'touchstart',
    'click',
    'keydown',
    'wheel',
    'input'
  ];
  function handle(event: Event) {
    if (event.type === 'click' && Date.now() < blockClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (isSleeping()) {
      if (event.type === 'wheel' || event.type === 'input') return;
      if (
        event.type === 'keydown' &&
        !['Enter', ' ', 'Spacebar'].includes((event as KeyboardEvent).key)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // A remote/touch pointer can synthesize a later click after sleep is removed.
      blockClickUntil = Date.now() + 750;
      wake();
      return;
    }
    wake();
  }
  for (const name of events)
    target.addEventListener(name, handle, { capture: true, passive: false });
  return () => {
    for (const name of events)
      target.removeEventListener(name, handle, { capture: true });
  };
}
