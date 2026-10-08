// End-to-end check of the whole game loop in headless Microsoft Edge (same setup as tools/shot.mjs).
//
// Usage:
//   node tools/e2e.mjs                                   # every scenario with the default seeds
//   node tools/e2e.mjs --scenario full --seeds 7,23:siam,5:yaowarat   # full trips only (seed[:district])
//   node tools/e2e.mjs --scenario fail|sweep --dir shots/e2e --timeout 360
// Scenarios:
//   full  — per seed: boot → title (press-any-key gate) → garage (equip an owned colour) → title → setup (rush) →
//           출근하기 → intro (gram phone; ?bot=1 auto-accepts the first call) → play (autopilot) until RESULTS or the
//           timeout → results. Screenshots of every state + every 10 s of play. Needs a completed (not failed) trip.
//   fail  — ?skip=play&bot=1, then window.__game.debug.failComfort(): the run must end on the receipt as F / comfort.
//   sweep — 3 seeds × 3 districts with ?skip=intro&bot=1: reach the INTRO and ride the first 20 s of PLAY.
// Prints console / page errors and the RunResults as JSON; exit code 1 on any error or failed check.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const scenario = opt('scenario', 'all');
// full trips: seed[:district] (no district = the forecast's own; trip 1 rolls Sukhumvit)
const trips = opt('seeds', '7,23:siam,5:yaowarat').split(',').map((s) => {
  const [seed, district] = s.split(':');
  return { seed: Number(seed), district };
});
const sweepSeeds = opt('sweep-seeds', '3,19,42').split(',').map(Number);
const districts = opt('districts', 'sukhumvit,silom,yaowarat').split(',');
const outDir = resolve(root, opt('dir', 'shots/e2e'));
const playTimeout = Number(opt('timeout', '360')) * 1000;

const cacheDir = resolve(root, 'node_modules/.vite-shots', `e2e-${process.pid}-${Date.now()}`);
const server = await createServer({
  root, cacheDir, logLevel: 'error', optimizeDeps: { entries: ['index.html'] },
  server: { port: 0, strictPort: false, hmr: false, watch: null },
});
await server.listen();
const base = `http://localhost:${server.httpServer.address().port}/`;
const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});

const game = (page, expr) => page.evaluate(`(() => { const g = window.__game; return ${expr}; })()`);
const waitState = (page, state, timeout) =>
  page.waitForFunction((s) => window.__game && window.__game.state === s, state, { timeout, polling: 150 });

/** one scenario run in a fresh browser context (fresh save) */
async function run(name, query, body) {
  const dir = resolve(outDir, name);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  const shots = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`page: ${e && e.stack ? e.stack : e}`));
  const shot = async (label) => {
    const file = resolve(dir, `${label}.png`);
    await page.screenshot({ path: file });
    shots.push(file);
  };
  const t0 = Date.now();
  let out = { ok: false };
  try {
    await page.goto(base + query, { waitUntil: 'load', timeout: 90000 });
    out = await body(page, shot);
  } catch (err) {
    out = { ok: false, reason: err && err.message ? err.message.split('\n')[0] : String(err) };
    try {
      out.state = await game(page, 'g && g.state');
      out.run = await game(page, 'g && g.run');
      await shot('zz-failure');
    } catch {
      /* the page may be gone */
    }
  } finally {
    await ctx.close();
  }
  const res = { name, query, seconds: Math.round((Date.now() - t0) / 1000), ...out, ok: out.ok && errors.length === 0, errors, shots };
  console.log(`${res.ok ? 'PASS' : 'FAIL'} ${name} (${res.seconds} s)${res.reason ? ` — ${res.reason}` : ''}${errors.length ? ` — ${errors.length} error(s)` : ''}`);
  return res;
}

/** play until RESULTS (or the timeout), a screenshot every 10 s */
async function ride(page, shot) {
  const t0 = Date.now();
  let next = 10000;
  await page.waitForTimeout(1500); // the crosswalk wipe uncovers the HUD
  await shot('08-play-000');
  while (Date.now() - t0 < playTimeout) {
    if ((await game(page, 'g.state')) === 'results') break;
    await page.waitForTimeout(500);
    if (Date.now() - t0 >= next) {
      await shot(`09-play-${String(next / 1000).padStart(3, '0')}`);
      next += 10000;
    }
  }
  return Math.round((Date.now() - t0) / 1000);
}

async function full(page, shot) {
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  await shot('01-boot');
  await waitState(page, 'title', 150000);
  await page.waitForTimeout(2600);
  await shot('02-title-gate');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1300);
  await shot('03-title');
  await page.click('button:has-text("차고")');
  await waitState(page, 'garage', 30000);
  await page.waitForTimeout(1800);
  await shot('04-garage');
  const before = await game(page, 'g.save.loadout');
  await page.locator('.g-swatches__grid button:not(.is-locked):not(.is-selected)').first().click();
  await page.waitForTimeout(700);
  await page.click('button:has-text("장착하기")');
  await page.waitForTimeout(1400);
  await shot('05-garage-equipped');
  const after = await game(page, 'g.save.loadout');
  if (after === before) throw new Error(`garage: equipping did not change the loadout (${after})`);
  await page.keyboard.press('Escape');
  await waitState(page, 'title', 20000);
  await page.waitForTimeout(900);
  await page.click('button:has-text("시작")');
  await waitState(page, 'setup', 20000);
  await page.waitForTimeout(1500);
  await page.keyboard.press('2');
  await page.waitForTimeout(600);
  await shot('06-setup');
  const memBefore = await game(page, 'g.mem');
  await page.click('button:has-text("출근하기")');
  await waitState(page, 'intro', 90000);
  await page.waitForTimeout(1800);
  await shot('07-intro');
  await waitState(page, 'play', 60000);
  const config = await game(page, 'g.config');
  const playSec = await ride(page, shot);
  if ((await game(page, 'g.state')) !== 'results') {
    return { ok: false, reason: `no RESULTS after ${playSec} s of play`, config, run: await game(page, 'g.run') };
  }
  await page.waitForTimeout(6500);
  await shot('10-results');
  const result = await game(page, 'g.result');
  // 다음 콜 받기 → a fresh Setup for trip 2 (the run is disposed, the trip counter advanced)
  await page.click('button:has-text("콜 받기")');
  await waitState(page, 'setup', 30000);
  await page.waitForTimeout(1500);
  await shot('11-next-setup');
  await page.waitForTimeout(600);
  const memAfter = await game(page, 'g.mem');
  const booked = await game(page, 'g.save.trips');
  const ok = !!result && result.failed === null && result.grade !== 'F' && booked === 1;
  return { ok, reason: ok ? undefined : `trip not completed (${result && result.failed}, trips ${booked})`, config, playSec, loadout: after, result, memBefore, memAfter };
}

async function fail(page, shot) {
  await waitState(page, 'play', 150000);
  await page.waitForTimeout(3000);
  await shot('01-play');
  if (!(await game(page, 'g.debug.failComfort()'))) throw new Error('failComfort() was refused');
  await waitState(page, 'results', 30000);
  await page.waitForTimeout(5500);
  await shot('02-results-fail');
  const result = await game(page, 'g.result');
  const ok = !!result && result.grade === 'F' && result.failed === 'comfort' && result.totalBaht === 0;
  return { ok, reason: ok ? undefined : 'expected an F / comfort receipt paying ฿0', result };
}

async function sweep(page, shot) {
  await waitState(page, 'intro', 150000);
  await page.waitForTimeout(1500);
  await shot('01-intro');
  await waitState(page, 'play', 60000);
  await page.waitForTimeout(1500);
  const start = await game(page, 'g.run');
  await page.waitForTimeout(18500);
  await shot('02-play-20s');
  const state = await game(page, 'g.state');
  const end = await game(page, 'g.run');
  const moved = start && end ? Math.hypot(end.pos[0] - start.pos[0], end.pos[1] - start.pos[1]) : 0;
  const ok = (state === 'play' || state === 'results') && moved > 5;
  return { ok, reason: ok ? undefined : `state ${state}, moved ${moved.toFixed(1)} m`, moved: Math.round(moved), config: await game(page, 'g.config'), run: end };
}

const results = [];
try {
  if (scenario === 'all' || scenario === 'full') {
    for (const t of trips) results.push(await run(`full-${t.seed}${t.district ? `-${t.district}` : ''}`, `?bot=1&seed=${t.seed}${t.district ? `&district=${t.district}` : ''}`, full));
  }
  if (scenario === 'all' || scenario === 'fail') results.push(await run(`fail-${trips[0].seed}`, `?skip=play&bot=1&seed=${trips[0].seed}`, fail));
  if (scenario === 'all' || scenario === 'sweep') {
    for (const seed of sweepSeeds) for (const d of districts) results.push(await run(`sweep-${seed}-${d}`, `?skip=intro&bot=1&seed=${seed}&district=${d}`, sweep));
  }
} finally {
  await browser.close();
  await server.close();
  try {
    rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed${failed.length ? ` — failed: ${failed.map((r) => r.name).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
