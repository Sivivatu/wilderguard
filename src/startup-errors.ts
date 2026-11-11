const MAX_STARTUP_ERRORS = 5;
const STARTUP_WINDOW_MS = 5000;
let pending: Error[] = [];
let cleanup: (() => void) | undefined;

// Temporary handlers close the lazy SDK-loading gap without retaining diagnostics indefinitely.
export function beginStartupCapture(): void {
  discardStartupCapture();
  const remember = (error: unknown) => {
    if (pending.length < MAX_STARTUP_ERRORS) pending = [...pending, error instanceof Error ? error : new Error('Unhandled startup failure')];
  };
  const onError = (event: ErrorEvent) => remember(event.error);
  const onRejection = (event: PromiseRejectionEvent) => remember(event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const timer = setTimeout(discardStartupCapture, STARTUP_WINDOW_MS);
  cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

export function discardStartupCapture(): void {
  cleanup?.(); cleanup = undefined; pending = [];
}

export function finishStartupCapture(capture: (error: Error) => void): void {
  const errors = pending;
  discardStartupCapture();
  errors.forEach(capture);
}
