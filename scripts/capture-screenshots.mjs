/**
 * Regenerates the README screenshots from the real, running app.
 *
 *   npm run build && npm start
 *   node scripts/capture-screenshots.mjs
 *
 * Point it somewhere else with MIRAI_BASE_URL. Chromium needs software WebGL
 * flags here: the headless default has no GPU, and without ANGLE/SwiftShader
 * the Live2D canvas silently renders nothing at all.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.MIRAI_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT = process.env.MIRAI_SHOT_DIR ?? 'docs/assets';

mkdirSync(OUT, { recursive: true });

/** The model credit only renders once the rig reports `ready`. */
const RIG_READY = 'text=/Live2D Inc/';

/**
 * Compositing a WebGL surface through SwiftShader is slow — a 2× DPR capture
 * of the stage regularly takes 30–60s, which blows straight past Playwright's
 * 30s default and looks like a hang.
 */
const SHOT_TIMEOUT = 180_000;

async function shot(page, name, out) {
  await page.screenshot({
    path: `${out}/${name}.png`,
    timeout: SHOT_TIMEOUT,
    // Freeze CSS animations so the aurora and pulse rings land in the same
    // place every run; the WebGL rig is unaffected and stays live.
    animations: 'disabled',
  });
  console.log('✓', name);
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

async function waitForRig(page, timeout = 90_000) {
  try {
    await page.waitForSelector(RIG_READY, { timeout });
    return true;
  } catch {
    console.warn('! rig did not reach ready state; capturing current state');
    return false;
  }
}

const context = await browser.newContext({
  viewport: { width: 1600, height: 950 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

const page = await context.newPage();
page.on('pageerror', (error) => console.warn('! page error:', String(error).slice(0, 160)));

console.log('→', BASE);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
await waitForRig(page);
// Let the idle drift settle into a natural pose rather than frame zero.
await page.waitForTimeout(2500);

await shot(page, 'screenshot-hero', OUT);

const box = page.getByPlaceholder(/Say something/i);
await box.click();
await box.fill('How does your lip sync actually work?');
await page.waitForTimeout(400);
await box.press('Enter');

// Catch the reply mid-stream, while the mouth and expression are moving.
await page.waitForTimeout(2600);
await shot(page, 'screenshot-streaming', OUT);

await page.waitForTimeout(6500);
await shot(page, 'screenshot-chat', OUT);

await page.getByRole('button', { name: 'Open settings' }).click();
await page.waitForTimeout(900);
await shot(page, 'screenshot-settings', OUT);

const debugToggle = page.getByRole('switch', { name: /diagnostics overlay/i });
if (await debugToggle.count()) {
  await debugToggle.click();
  await page.waitForTimeout(500);
}
await page.getByRole('button', { name: 'Close settings' }).click();
await page.waitForTimeout(1400);
await shot(page, 'screenshot-debug', OUT);

const mobile = await browser.newContext({
  viewport: { width: 420, height: 880 },
  deviceScaleFactor: 3,
  colorScheme: 'dark',
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
await waitForRig(mobilePage, 90_000);
await mobilePage.waitForTimeout(2000);
await shot(mobilePage, 'screenshot-mobile', OUT);

await browser.close();
console.log('done →', OUT);
