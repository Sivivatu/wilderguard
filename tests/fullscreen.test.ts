import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupFullscreen } from '../src/fullscreen';

class FakeClasses {
  private values = new Set<string>();
  contains(value: string) { return this.values.has(value); }
  toggle(value: string, force: boolean) {
    if (force) this.values.add(value); else this.values.delete(value);
    return force;
  }
}

function browser() {
  const doc = new EventTarget() as EventTarget & {
    fullscreenEnabled: boolean;
    fullscreenElement: object | null;
    documentElement: { classList: FakeClasses; requestFullscreen?: () => Promise<void> };
    exitFullscreen?: () => Promise<void>;
  };
  doc.fullscreenEnabled = true;
  doc.fullscreenElement = null;
  doc.documentElement = { classList: new FakeClasses() };
  doc.documentElement.requestFullscreen = vi.fn(async () => {
    doc.fullscreenElement = doc.documentElement;
    doc.dispatchEvent(new Event('fullscreenchange'));
  });
  doc.exitFullscreen = vi.fn(async () => {
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
  });
  const attrs = new Map<string, string>();
  const events = new EventTarget();
  const button = Object.assign(events, {
    ownerDocument: doc, hidden: false, disabled: false,
    setAttribute: (key: string, value: string) => attrs.set(key, value),
    getAttribute: (key: string) => attrs.get(key),
    click: () => events.dispatchEvent(new Event('click')),
  });
  const onError = vi.fn();
  const setup = (options = {}) => setupFullscreen(button as unknown as HTMLButtonElement,
    { native: false, installed: false, onError, ...options });
  return { doc, button, setup, onError };
}

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
afterEach(() => vi.restoreAllMocks());

describe('fullscreen control', () => {
  it.each(['native', 'installed'] as const)('hides an already installed %s screen control', kind => {
    const { button, setup, doc } = browser();
    setup({ [kind]: true });
    expect(button.hidden).toBe(true);
    button.click();
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'missing-request', 'missing-exit'] as const)('hides unsupported fullscreen: %s', mode => {
    const { button, doc, setup } = browser();
    if (mode === 'disabled') doc.fullscreenEnabled = false;
    if (mode === 'missing-request') doc.documentElement.requestFullscreen = undefined;
    if (mode === 'missing-exit') doc.exitFullscreen = undefined;
    setup();
    expect(button.hidden).toBe(true);
  });

  it('enters actual browser fullscreen, updates focus, and exits through the same control', async () => {
    const { button, doc, setup, onError } = browser();
    setup();
    expect(button.hidden).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click(); await settle();
    expect(doc.fullscreenElement).toBe(doc.documentElement);
    expect(doc.documentElement.classList.contains('battle-focus')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Exit full screen');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click(); await settle();
    expect(doc.fullscreenElement).toBeNull();
    expect(doc.documentElement.classList.contains('battle-focus')).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Toggle full screen');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps a battle-focus layout that was already selected before entering fullscreen', async () => {
    const { button, doc, setup } = browser();
    setup();
    doc.documentElement.classList.toggle('battle-focus', true);
    button.click(); await settle();
    await doc.exitFullscreen!();
    expect(doc.documentElement.classList.contains('battle-focus')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('synchronizes an external browser exit instead of showing an active control', async () => {
    const { button, doc, setup } = browser();
    setup();
    button.click(); await settle();
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(doc.documentElement.classList.contains('battle-focus')).toBe(false);
  });

  it.each(['request', 'exit'] as const)('handles a rejected %s without leaving an inert button', async method => {
    const { button, doc, setup, onError } = browser();
    if (method === 'request') doc.documentElement.requestFullscreen = vi.fn(async () => { throw new Error('not supported'); });
    else {
      doc.fullscreenElement = doc.documentElement;
      doc.exitFullscreen = vi.fn(async () => { throw new Error('not supported'); });
    }
    setup();
    button.click(); await settle();
    expect(button.hidden).toBe(true);
    expect(button.disabled).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatch(/full screen.*unavailable/i);
    doc.dispatchEvent(new Event('fullscreenchange'));
    expect(button.hidden).toBe(true);
  });

  it('detects a WebView promise that resolves without opening fullscreen', async () => {
    const { button, doc, setup, onError } = browser();
    doc.documentElement.requestFullscreen = vi.fn(async () => undefined);
    setup();
    button.click(); await settle();
    expect(doc.documentElement.classList.contains('battle-focus')).toBe(false);
    expect(button.hidden).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('does not start a second request while the first is pending', async () => {
    const { button, doc, setup } = browser();
    let finish!: () => void;
    doc.documentElement.requestFullscreen = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    setup();
    button.click(); button.click();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    doc.fullscreenElement = doc.documentElement;
    finish(); await settle();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
