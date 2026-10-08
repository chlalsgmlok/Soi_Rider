/** SOI RIDER entry (index.html): the WebGL canvas #gl under the DOM UI overlay #ui. */
import { App } from './app/app';

const canvas = document.getElementById('gl');
const uiRoot = document.getElementById('ui');
if (!(canvas instanceof HTMLCanvasElement) || !uiRoot) throw new Error('[soi-rider] index.html needs <canvas id="gl"> and <div id="ui">');
App.start(canvas, uiRoot).catch((err: unknown) => console.error('[soi-rider] failed to start', err));
