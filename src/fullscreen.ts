interface FullscreenOptions {
  native: boolean;
  installed: boolean;
  onError: (message: string) => void;
}

/** Offer browser fullscreen only when the host can make a visible transition. */
export function setupFullscreen(button: HTMLButtonElement, options: FullscreenOptions): void {
  const doc = button.ownerDocument;
  const root = doc.documentElement;
  let available = !options.native && !options.installed && doc.fullscreenEnabled === true
    && typeof root.requestFullscreen === 'function' && typeof doc.exitFullscreen === 'function';
  button.hidden = !available;
  if (!available) return;

  let preserveFocus = root.classList.contains('battle-focus');
  let pending = false;
  const sync = () => {
    const active = !!doc.fullscreenElement;
    root.classList.toggle('battle-focus', preserveFocus || active);
    button.setAttribute('aria-label', active ? 'Exit full screen' : 'Toggle full screen');
    button.setAttribute('aria-pressed', String(active));
    button.hidden = !available;
  };
  doc.addEventListener('fullscreenchange', sync);
  sync();

  button.addEventListener('click', () => {
    if (!available || pending) return;
    pending = true;
    button.disabled = true;
    const exit = !!doc.fullscreenElement;
    if (!exit) preserveFocus = root.classList.contains('battle-focus');
    void (async () => {
      try {
        if (exit) await doc.exitFullscreen(); else await root.requestFullscreen();
        if (!!doc.fullscreenElement === exit) throw new Error('The host did not change fullscreen state.');
      } catch {
        available = false;
        options.onError('Full screen is unavailable in this app or browser. The control has been hidden.');
      } finally {
        pending = false;
        button.disabled = false;
        sync();
      }
    })();
  });
}
