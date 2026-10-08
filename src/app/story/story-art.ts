/** one rendered story still (blender/story → public/assets/story, listed in manifest.json) */
export interface StoryStill {
  id: string;
  /** full image (1600×900) */
  src: string;
  /** small image (640×360) — the comic panels use this */
  thumb: string;
  caption: string;
}

interface ManifestEntry {
  id: string;
  file: string;
  thumb?: string;
  caption_ko?: string;
}

const isEntry = (v: unknown): v is ManifestEntry => {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.file === 'string' &&
    (e.thumb === undefined || typeof e.thumb === 'string') && (e.caption_ko === undefined || typeof e.caption_ko === 'string');
};

/** manifest paths are file names next to it (or site-relative paths) */
const resolveIn = (base: string, f: string): string => (f.includes('/') ? f.replace(/^\/+/, '') : base + f);

/** The story key art (comic stills of the intro and the raincoat / mask moments). */
export class StoryArt {
  private constructor(private readonly stills: ReadonlyMap<string, StoryStill>) {}

  /** reads public/assets/story/manifest.json; null without one (the game runs without the panels) */
  static async load(base = 'assets/story/'): Promise<StoryArt | null> {
    try {
      const res = await fetch(`${base}manifest.json`);
      // a missing manifest is normal while the art is being made (the dev server answers with its HTML fallback)
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
      const list: unknown = await res.json();
      if (!Array.isArray(list)) return null;
      const stills = new Map<string, StoryStill>();
      for (const e of list) {
        if (!isEntry(e)) continue;
        const src = resolveIn(base, e.file);
        stills.set(e.id, { id: e.id, src, thumb: e.thumb ? resolveIn(base, e.thumb) : src, caption: e.caption_ko ?? '' });
      }
      return new StoryArt(stills);
    } catch (err) {
      console.warn('[story] the story art manifest could not be read', err);
      return null;
    }
  }

  get(id: string): StoryStill | null {
    return this.stills.get(id) ?? null;
  }
}
