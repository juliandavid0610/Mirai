import type { CubismVersion } from '@/types/live2d';
import { createLogger } from '@/lib/utils/logger';

const log = createLogger('runtime');

/**
 * Live2D's Cubism Core is proprietary and cannot be redistributed on npm, so
 * it has to be pulled in at runtime from Live2D's own CDN. That is a hard
 * licensing constraint, not a packaging choice — see docs/LIVE2D.md.
 *
 * Both runtimes are loaded lazily and at most once. The promise itself is the
 * cache, which means concurrent callers (the stage mounting while the model
 * picker prefetches, say) share a single network request instead of racing.
 */
export const CUBISM_CORE_URLS: Record<CubismVersion, string> = {
  4: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  2: 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
};

const loaders = new Map<CubismVersion, Promise<void>>();

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
    Live2D?: unknown;
  }
}

function alreadyPresent(version: CubismVersion): boolean {
  if (typeof window === 'undefined') return false;
  return version === 4
    ? typeof window.Live2DCubismCore !== 'undefined'
    : typeof window.Live2D !== 'undefined';
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-mirai-runtime="${src}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.miraiRuntime = src;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

/** Ensures the Cubism Core for `version` is present on `window`. */
export function loadCubismCore(version: CubismVersion): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cubism Core requires a browser'));
  }
  if (alreadyPresent(version)) return Promise.resolve();

  const cached = loaders.get(version);
  if (cached) return cached;

  const url = CUBISM_CORE_URLS[version];
  log.info(`loading Cubism ${version} core`, url);

  const task = injectScript(url)
    .then(() => {
      if (!alreadyPresent(version)) {
        throw new Error(
          `Cubism ${version} core loaded but did not register on window`,
        );
      }
      log.info(`Cubism ${version} core ready`);
    })
    .catch((error) => {
      // Drop the cache so a later retry (e.g. after the network comes back)
      // is not permanently poisoned by one failure.
      loaders.delete(version);
      throw error;
    });

  loaders.set(version, task);
  return task;
}

/**
 * Loads PixiJS and the matching Cubism runtime, then wires the shared ticker.
 *
 * Two things here are load-bearing and both cost an afternoon to find:
 *
 *  1. **Import the version-specific entry, never the combined one.** The root
 *     `pixi-live2d-display` bundle pulls in *both* runtimes, and the Cubism 2
 *     half throws "requires live2d.min.js to be loaded" at import time. Since
 *     almost every modern rig is Cubism 4, the combined entry fails on a
 *     perfectly valid model unless you also ship a legacy runtime you will
 *     never use. Importing `/cubism4` (or `/cubism2`) avoids that and halves
 *     the bundle.
 *
 *  2. **The core must be on `window` before the runtime module is imported**,
 *     hence the sequential await rather than a `Promise.all`.
 *
 * `registerTicker` has to happen before any model is created, or `autoUpdate`
 * silently does nothing and the rig renders as a frozen first frame — the
 * single most common "my model doesn't move" report.
 */
export async function loadPixiRuntime(version: CubismVersion) {
  await loadCubismCore(version);

  const PIXI = await import('pixi.js');
  const live2d =
    version === 2
      ? await import('pixi-live2d-display/cubism2')
      : await import('pixi-live2d-display/cubism4');

  live2d.Live2DModel.registerTicker(PIXI.Ticker);

  return {
    PIXI,
    Live2DModel: live2d.Live2DModel,
    MotionPriority: live2d.MotionPriority,
  };
}

export type PixiRuntime = Awaited<ReturnType<typeof loadPixiRuntime>>;
