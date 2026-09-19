/**
 * Records the README demo GIF from the real, running app.
 *
 *   npm run build && npm start
 *   node scripts/capture-demo.mjs
 *
 * Playwright records WebM; the GIF is produced with the ffmpeg binary that
 * ships with Playwright, so there is no extra system dependency. The two-pass
 * palettegen/paletteuse filter is not optional — a single-pass GIF of this
 * scene bands horribly, because the whole design is dark gradients and the
 * default 256-colour quantiser spends its palette on the wrong things.
 */
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveFfmpeg } from './ffmpeg.mjs';

const BASE = process.env.MIRAI_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT = process.env.MIRAI_SHOT_DIR ?? 'docs/assets';
const WORK = process.env.MIRAI_WORK_DIR ?? '.mirai-capture';

const FFMPEG = await resolveFfmpeg();

/**
 * Wide enough to read the transcript, small enough for a sane GIF.
 *
 * GIF has no interframe compression worth the name, so file size is very
 * nearly `width × height × frames`. 820px at 10fps keeps a 13-second demo
 * under about 5MB, which is the most a README image should ever cost someone
 * on a phone.
 */
const SIZE = { width: 1280, height: 760 };
const GIF_WIDTH = 820;
const FPS = 10;
const DEMO_SECONDS = 13;

mkdirSync(OUT, { recursive: true });
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
  ],
});

const context = await browser.newContext({
  viewport: SIZE,
  colorScheme: 'dark',
  recordVideo: { dir: WORK, size: SIZE },
});

const page = await context.newPage();
// Recording begins with the first page of the context; everything before the
// rig is ready gets trimmed off the front below.
const recordingStart = Date.now();
console.log('→', BASE);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });

try {
  await page.waitForSelector('text=/Live2D Inc/', { timeout: 90_000 });
} catch {
  console.warn('! rig never became ready — the recording will be of a spinner');
}

// Let the rig settle clear of the loading spinner before anything happens.
// The front of this is trimmed off, so it costs nothing.
await page.waitForTimeout(4000);

const box = page.getByPlaceholder(/Say something/i);
// Everything from here is the demo. This timestamp is the anchor the trim is
// measured back from — see the note on TAIL below.
const interactionStart = Date.now();
await box.click();
// Typed rather than filled, so the GIF shows the composer in use.
await box.type('How does your lip sync actually work?', { delay: 55 });
await page.waitForTimeout(500);
await box.press('Enter');

// Long enough for the scripted reply to stream through two emotion changes.
await page.waitForTimeout(11_000);

const endedAt = Date.now();
const wallSeconds = (endedAt - recordingStart) / 1000;
const interactionWallSeconds = (endedAt - interactionStart) / 1000;
await context.close();
await browser.close();

const webm = readdirSync(WORK).find((file) => file.endsWith('.webm'));
if (!webm) throw new Error('playwright produced no recording');
const source = join(WORK, webm);
const palette = join(WORK, 'palette.png');
const gif = join(OUT, 'demo.gif');

const filters = `fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;

/**
 * Reads a file's duration by decoding it to null and parsing the last
 * progress line. Crude, but it avoids a separate ffprobe dependency.
 */
function durationSeconds(file) {
  const { stderr } = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const matches = [...(stderr ?? '').matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  const last = matches.at(-1);
  if (!last) return 0;
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
}

/**
 * Trim from the END of the recording, not the start.
 *
 * Seeking forward from the start needs to know when the rig finished loading,
 * and that is the one thing in this script that cannot be pinned down: it is a
 * CDN fetch rendered through SwiftShader, and it varied between 14s and 42s
 * across runs on the same machine. Worse, Playwright's WebM is
 * variable-frame-rate and runs shorter than the wall time it covers, so a
 * wall-clock offset does not map onto it linearly.
 *
 * The tail, by contrast, is entirely controlled by this script's own waits.
 * Anchoring to the end and counting backwards makes the trim exact no matter
 * how long loading took.
 */
const videoSeconds = durationSeconds(source);
const clockRatio = wallSeconds > 0 && videoSeconds > 0 ? videoSeconds / wallSeconds : 1;

/** Seconds of settled, idle character to show before the typing starts. */
const LEAD_IN = 1.5;
const tailSeconds = Math.min(
  videoSeconds,
  (interactionWallSeconds + LEAD_IN) * clockRatio,
);

/** `-sseof` is a negative offset from the end of the input. */
const trim = ['-sseof', `-${tailSeconds.toFixed(2)}`, '-t', String(DEMO_SECONDS)];

console.log(`→ generating palette (keeping the last ${tailSeconds.toFixed(1)}s)`);
execFileSync(FFMPEG, [
  '-y', ...trim, '-i', source,
  // `stats_mode=diff` weights the palette toward the pixels that actually
  // change, which on a mostly-static dark scene is the character and the text.
  '-vf', `${filters},palettegen=stats_mode=diff`,
  palette,
], { stdio: 'ignore' });

console.log('→ encoding gif');
execFileSync(FFMPEG, [
  '-y', ...trim, '-i', source, '-i', palette,
  // Bayer dithering is blockier than Floyd-Steinberg but compresses far
  // better, and `diff_mode=rectangle` lets unchanged regions be skipped.
  '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
  '-loop', '0',
  gif,
], { stdio: 'ignore' });

rmSync(WORK, { recursive: true, force: true });

const mb = (statSync(gif).size / 1024 / 1024).toFixed(2);
console.log(`✓ ${gif} (${mb} MB)`);
