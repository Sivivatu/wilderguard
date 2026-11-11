import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { beginStartupCapture, discardStartupCapture, finishStartupCapture } from '../src/startup-errors';
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { discardStartupCapture(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('buffers at most five early errors and removes temporary handlers after SDK startup', () => {
  beginStartupCapture();
  for (let i = 0; i < 12; i++) {
    const event = new Event('error'); Object.assign(event, { error: new Error('early') }); window.dispatchEvent(event);
  }
  const capture = vi.fn(); finishStartupCapture(capture);
  expect(capture).toHaveBeenCalledTimes(5);
  window.dispatchEvent(new Event('error'));
  finishStartupCapture(capture); expect(capture).toHaveBeenCalledTimes(5);
});
it('expires the startup buffer and handles non-Error rejections without copying their data', () => {
  beginStartupCapture();
  const event = new Event('unhandledrejection'); Object.assign(event, { reason: { save: 'private' } }); window.dispatchEvent(event);
  const capture = vi.fn(); finishStartupCapture(capture);
  expect(capture.mock.calls[0][0].message).toBe('Unhandled startup failure');
  beginStartupCapture(); window.dispatchEvent(event); vi.advanceTimersByTime(5000);
  finishStartupCapture(capture); expect(capture).toHaveBeenCalledTimes(1);
});
