/**
 * Raw three.js GLB viewer for asset QA (independent of src/engine so it works before the engine exists).
 * sandbox/models.html?models=veh_taxi,veh_van&view=diorama|side|front|top&tod=sunset|noon|night
 * Sets window.__ready = true once every model has loaded (or failed) — use with tools/shot.mjs "until:".
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const names = (params.get('models') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const view = params.get('view') ?? 'diorama';
const tod = params.get('tod') ?? 'sunset';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const LIGHTS: Record<string, { sky: string; ground: string; sun: string; sunI: number; bg: string }> = {
  sunset: { sky: '#ffd9b0', ground: '#7a5f55', sun: '#ffc27a', sunI: 3.2, bg: '#f4b98a' },
  noon: { sky: '#dff0ff', ground: '#8a7a6a', sun: '#fff4e0', sunI: 3.4, bg: '#9fd0f5' },
  night: { sky: '#3a3f6e', ground: '#20202a', sun: '#8fa6ff', sunI: 0.6, bg: '#1b1f3a' },
};
const L = LIGHTS[tod] ?? LIGHTS.sunset;
scene.background = new THREE.Color(L.bg);
scene.add(new THREE.HemisphereLight(L.sky, L.ground, 1.4));
const sun = new THREE.DirectionalLight(L.sun, L.sunI);
sun.position.set(-12, 16, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.camera.left = sun.shadow.camera.bottom = -40;
sun.shadow.camera.right = sun.shadow.camera.top = 40;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#6e6762', roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const labels = document.createElement('div');
labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 13px system-ui;color:#fff;text-shadow:0 1px 2px #000';
document.body.appendChild(labels);

const camera = new THREE.PerspectiveCamera(view === 'diorama' ? 36 : 30, innerWidth / innerHeight, 0.05, 2000);
const loader = new GLTFLoader();
const loaded: Array<{ name: string; obj: THREE.Object3D; size: THREE.Vector3 }> = [];

async function loadAll(): Promise<void> {
  for (const name of names) {
    try {
      const gltf = await loader.loadAsync(`/assets/models/${name}.glb`);
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      loaded.push({ name, obj: gltf.scene, size: box.getSize(new THREE.Vector3()) });
    } catch (err) {
      console.error(`[models] failed to load ${name}`, err);
    }
  }
  let x = 0;
  const gap = 0.6;
  const total = loaded.reduce((s, m) => s + m.size.x + gap, -gap);
  x = -total / 2;
  for (const m of loaded) {
    m.obj.position.x = x + m.size.x / 2;
    x += m.size.x + gap;
    scene.add(m.obj);
  }
  const all = new THREE.Box3();
  for (const m of loaded) all.expandByObject(m.obj);
  const c = all.getCenter(new THREE.Vector3());
  const s = Math.max(all.getSize(new THREE.Vector3()).length(), 1);
  const dirs: Record<string, THREE.Vector3> = {
    diorama: new THREE.Vector3(-0.55, 0.75, 1),
    side: new THREE.Vector3(-1, 0.25, 0.0001),
    front: new THREE.Vector3(0, 0.3, 1),
    top: new THREE.Vector3(0, 1, 0.001),
  };
  camera.position.copy(c).addScaledVector((dirs[view] ?? dirs.diorama).normalize(), s * (view === 'diorama' ? 1.35 : 1.15));
  camera.lookAt(c);
  for (const m of loaded) {
    const p = m.obj.position.clone().setY(-0.2).project(camera);
    const el = document.createElement('div');
    el.textContent = `${m.name} ${m.size.x.toFixed(2)}×${m.size.y.toFixed(2)}×${m.size.z.toFixed(2)}`;
    el.style.cssText = `position:absolute;left:${((p.x + 1) / 2) * innerWidth}px;top:${((1 - p.y) / 2) * innerHeight + 8}px;transform:translateX(-50%)`;
    labels.appendChild(el);
  }
}

loadAll().finally(() => {
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  requestAnimationFrame(() => requestAnimationFrame(() => ((window as unknown as { __ready: boolean }).__ready = true)));
});
