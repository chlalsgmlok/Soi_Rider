// Headless runtime check: boots a Vite dev server, opens a page in headless Microsoft Edge,
// optionally drives keyboard input, captures screenshots + console errors.
//
// Usage:
//   node tools/shot.mjs --page sandbox/player.html --wait 4000 --out shots/player.png
//   node tools/shot.mjs --page "" --steps "wait:3000,shot:title,key:Enter,wait:1500,shot:garage"
//   node tools/shot.mjs --page sandbox/player.html --steps "wait:2000,hold:KeyW:2500,hold:KeyD:600,shot:ride"
// Steps (separate with "," — or with "|" when an expression contains commas):
//   wait:<ms> | shot:<name> | key:<Code> | hold:<Code>:<ms> | down:<Code> | up:<Code> | click:<css selector>
//   eval:<js expression>          → result printed in logs
//   until:<timeoutMs>:<js expr>   → waits until the expression is truthy (e.g. until:15000:window.__ready)
// Screenshots go to --dir (default shots/). Prints a JSON summary (console errors, page errors, screenshots).
// Exit code 1 if page errors occurred. Each run uses its own Vite cache dir, so many runs can happen in parallel.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const rawPage = opt('page', '');
// Git Bash rewrites leading-slash args into Windows paths, so pages are passed WITHOUT the slash.
const page = '/' + rawPage.replace(/^[A-Za-z]:[\\/].*?Git[\\/]/, '').replace(/^[\\/]+/, '');
const width = Number(opt('width', '1280'));
const height = Number(opt('height', '720'));
const dir = resolve(root, opt('dir', 'shots'));
const out = opt('out', null);
const steps = opt('steps', `wait:${opt('wait', '3000')},shot:${out ? '__out' : 'page'}`);
mkdirSync(dir, { recursive: true });

const cacheDir = resolve(root, 'node_modules/.vite-shots', `${process.pid}-${Date.now()}`);
// Only scan the captured page for deps: other agents' half-written sandboxes would otherwise trigger
// "504 Outdated Optimize Dep" re-optimisation mid-run.
const pageFile = page.split('?')[0].replace(/^\//, '') || 'index.html';
const server = await createServer({
  root,
  cacheDir,
  logLevel: 'error',
  optimizeDeps: { entries: [pageFile.endsWith('/') ? `${pageFile}index.html` : pageFile] },
  server: { port: 0, strictPort: false, hmr: false, watch: null },
});
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
const tab = await ctx.newPage();
const consoleErrors = [];
const pageErrors = [];
const logs = [];
tab.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
  else if (logs.length < 60) logs.push(`${m.type()}: ${m.text()}`);
});
tab.on('pageerror', (e) => pageErrors.push(String(e && e.stack ? e.stack : e)));
const shots = [];
const url = `http://localhost:${port}${page}`;
try {
  await tab.goto(url, { waitUntil: 'load', timeout: 60000 });
  const list = steps.includes('|') ? steps.split('|') : steps.split(',');
  for (const raw of list.map((s) => s.trim()).filter(Boolean)) {
    const [cmd, a, b] = raw.split(':');
    if (cmd === 'wait') await tab.waitForTimeout(Number(a));
    else if (cmd === 'shot') {
      const file = a === '__out' ? resolve(root, out) : resolve(dir, `${a}.png`);
      mkdirSync(dirname(file), { recursive: true });
      await tab.screenshot({ path: file });
      shots.push(file);
    } else if (cmd === 'key') await tab.keyboard.press(a);
    else if (cmd === 'down') await tab.keyboard.down(a);
    else if (cmd === 'up') await tab.keyboard.up(a);
    else if (cmd === 'hold') {
      await tab.keyboard.down(a);
      await tab.waitForTimeout(Number(b));
      await tab.keyboard.up(a);
    } else if (cmd === 'click') await tab.click(raw.slice(6), { timeout: 5000 });
    else if (cmd === 'eval') logs.push(`eval => ${JSON.stringify(await tab.evaluate(raw.slice(5)))}`);
    else if (cmd === 'until') {
      const expr = raw.split(':').slice(2).join(':');
      await tab.waitForFunction(expr, null, { timeout: Number(a), polling: 200 });
    }
  }
  const gl = await tab.evaluate(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    const ext = g && g.getExtension('WEBGL_debug_renderer_info');
    return g ? (ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'webgl2') : 'NO WEBGL2';
  });
  logs.push(`gl renderer: ${gl}`);
} catch (err) {
  pageErrors.push(`[shot.mjs] ${err && err.message ? err.message : err}`);
} finally {
  await browser.close();
  await server.close();
  try {
    rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    /* cache cleanup is best-effort */
  }
}
console.log(JSON.stringify({ url, shots, consoleErrors, pageErrors, logs }, null, 2));
process.exit(pageErrors.length ? 1 : 0);
