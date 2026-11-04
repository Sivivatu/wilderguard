export const TERRAIN_ART_URLS = [
  new URL('./assets/terrain-greenfields.webp', import.meta.url).href,
  new URL('./assets/terrain-woods.webp', import.meta.url).href,
  new URL('./assets/terrain-sunstone.webp', import.meta.url).href,
  new URL('./assets/terrain-frostfall.webp', import.meta.url).href,
  new URL('./assets/terrain-hollow-crown.webp', import.meta.url).href,
] as const;

export function loadTerrainArt(): Promise<HTMLImageElement[]> {
  return Promise.all(TERRAIN_ART_URLS.map(url => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Terrain artwork could not load. Reload to try again.'));
    image.src = url;
  })));
}
