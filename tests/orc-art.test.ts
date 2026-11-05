import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadOrcArt, ORC_ART_URLS } from '../src/orc-art';

afterEach(() => vi.unstubAllGlobals());

function stubImages(fails = false) {
  const images: Array<{ src: string }> = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private url = '';
    get src() { return this.url; }
    set src(value: string) {
      this.url = value;
      queueMicrotask(() => fails ? this.onerror?.() : this.onload?.());
    }
    constructor() { images.push(this); }
  }
  vi.stubGlobal('Image', FakeImage);
  return images;
}

describe('approved Sunburst artwork', () => {
  it('loads a separate bundled sprite for each orc before resolving', async () => {
    const images = stubImages();
    const sprites = await loadOrcArt();
    expect(Object.keys(sprites)).toEqual(['clubber', 'axeman', 'chieftain', 'thrower']);
    expect(images).toHaveLength(4);
    for (const [kind, url] of Object.entries(ORC_ART_URLS)) {
      expect(url).toMatch(/orc-.*\.png$/);
      expect(sprites[kind as keyof typeof sprites].src).toBe(url);
    }
  });

  it('reports a failed asset load instead of allowing invisible enemies', async () => {
    stubImages(true);
    await expect(loadOrcArt()).rejects.toThrow('Orc artwork could not load');
  });
});
