/**
 * Locates an ffmpeg that can actually encode.
 *
 * Note the build Playwright ships is deliberately *not* used: it is a minimal
 * VP8-decode-only binary with no GIF or WebP encoder and no palette filters.
 * Install `ffmpeg-static`, or point FFMPEG_PATH at a full system build.
 */
export async function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const mod = await import('ffmpeg-static');
    const path = mod.default ?? mod;
    if (typeof path === 'string' && path) return path;
  } catch {
    /* not installed — fall through to the system binary */
  }
  return 'ffmpeg';
}
