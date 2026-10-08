// Runs a Blender Python script headless through the Microsoft Store launcher.
// The Store launcher does not forward stdout, so scripts log to blender/logs/<name>.log
// (see blender/lib/bootstrap.py) and this runner prints that log afterwards.
// Usage: node blender/run-blender.mjs blender/assets/vehicles/taxi.py [--render]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const launcher = process.env.BLENDER_BIN
  || resolve(process.env.LOCALAPPDATA || '', 'Microsoft/WindowsApps/BlenderFoundation.Blender4.5LTS_ppwjx1n5r4v9t/blender-launcher.exe');

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error('usage: node blender/run-blender.mjs <script.py> [args...]');
  process.exit(2);
}
const scriptPath = resolve(root, script);
if (!existsSync(scriptPath)) {
  console.error(`script not found: ${scriptPath}`);
  process.exit(2);
}
mkdirSync(resolve(here, 'logs'), { recursive: true });
const logPath = resolve(here, 'logs', `${basename(scriptPath, '.py')}.log`);
const args = ['-b', '--factory-startup', '--python-exit-code', '3', '--python', scriptPath, '--', '--log', logPath, '--root', root, ...rest];
const started = Date.now();
const res = spawnSync(launcher, args, { stdio: 'inherit', windowsHide: true });
const secs = ((Date.now() - started) / 1000).toFixed(1);
if (existsSync(logPath)) process.stdout.write(readFileSync(logPath, 'utf8'));
console.log(`[run-blender] ${basename(scriptPath)} exit=${res.status} in ${secs}s`);
process.exit(res.status ?? 1);
