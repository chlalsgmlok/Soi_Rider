/**
 * Global screen registry. Screen modules register themselves once (at import time or from src/ui/screens/index.ts):
 *   registerScreen('pause', mountPause, { overlay: true });
 */
import type { ScreenId } from '../../core/types/screens';
import type { ScreenMount, ScreenOptions } from './screen-types';

export interface RegisteredScreen<K extends ScreenId> {
  mount: ScreenMount<K>;
  opts: ScreenOptions;
}

type Registry = { [K in ScreenId]?: RegisteredScreen<K> };

const registry: Registry = {};
const DEFAULT_OVERLAYS: ReadonlySet<ScreenId> = new Set<ScreenId>(['pause', 'settings']);

export function registerScreen<K extends ScreenId>(id: K, mount: ScreenMount<K>, opts: ScreenOptions = {}): void {
  if (registry[id]) console.warn(`[ui] screen "${id}" registered twice — replacing`);
  const entry: RegisteredScreen<K> = { mount, opts: { overlay: DEFAULT_OVERLAYS.has(id), ...opts } };
  (registry as Record<K, RegisteredScreen<K>>)[id] = entry;
}

export function getScreen<K extends ScreenId>(id: K): RegisteredScreen<K> | undefined {
  return (registry as Partial<Record<K, RegisteredScreen<K>>>)[id];
}

export function hasScreen(id: ScreenId): boolean {
  return registry[id] !== undefined;
}

export function isDefaultOverlay(id: ScreenId): boolean {
  return DEFAULT_OVERLAYS.has(id);
}

/** test/sandbox helper */
export function unregisterScreen(id: ScreenId): void {
  delete registry[id];
}
