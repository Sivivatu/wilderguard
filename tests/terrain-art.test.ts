import { afterEach, expect, it, vi } from 'vitest';
import { loadTerrainArt } from '../src/terrain-art';

afterEach(() => vi.unstubAllGlobals());

function imageLoader(failingRegion?: string) {
  class FakeImage {
    onload?: () => void;
    onerror?: () => void;
    srcValue = '';
    get src() { return this.srcValue; }
    set src(url: string) {
      this.srcValue = url;
      queueMicrotask(() => failingRegion && url.includes(failingRegion) ? this.onerror?.() : this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

it('preloads five distinct bundled region backgrounds for offline switching', async () => {
  imageLoader();
  const terrain = await loadTerrainArt();
  expect(terrain).toHaveLength(5);
  expect(new Set(terrain.map(image => image.src)).size).toBe(5);
  expect(terrain[0].src).toContain('terrain-greenfields');
  expect(terrain[4].src).toContain('terrain-hollow-crown');
});

it('reports a terrain failure before the battlefield becomes ready', async () => {
  imageLoader('frostfall');
  await expect(loadTerrainArt()).rejects.toThrow('Terrain artwork could not load');
});
