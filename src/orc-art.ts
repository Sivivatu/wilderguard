import type { Enemy } from './game';

export const ORC_ART_URLS: Record<Enemy['kind'], string> = {
  clubber: new URL('./assets/orc-clubber.png', import.meta.url).href,
  axeman: new URL('./assets/orc-axeman.png', import.meta.url).href,
  chieftain: new URL('./assets/orc-chieftain.png', import.meta.url).href,
};
export type OrcArt = Record<Enemy['kind'], HTMLImageElement>;

export async function loadOrcArt(): Promise<OrcArt> {
  const entries = await Promise.all(Object.entries(ORC_ART_URLS).map(([kind, url]) =>
    new Promise<[string, HTMLImageElement]>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([kind, image]);
      image.onerror = () => reject(new Error('Orc artwork could not load. Reload to try again.'));
      image.src = url;
    })));
  return Object.fromEntries(entries) as OrcArt;
}
