import type { CityData } from '../../core/types';

/** every GLB the city view of `data` needs preloaded (placements + the signal heads + the skytrain) */
export function cityAssetNames(data: CityData): string[] {
  const names = new Set<string>(data.placements.map((p) => p.asset));
  names.add('bld_shophouse_3f');
  if (data.edges.some((e) => e.skytrain)) names.add('bts_train');
  return [...names];
}

/** load the sign fonts (Thai / Korean / Latin) before the sign atlas is drawn; resolves even when unavailable */
export async function preloadCityFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const faces = ['700 64px Kanit', '800 64px Kanit', '500 64px Kanit', '700 64px "Pretendard Variable"'];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f, 'กขคABC가나')));
  } catch (err) {
    console.warn('[city] sign fonts unavailable, falling back to system fonts', err);
  }
}
