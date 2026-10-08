# Architecture — SOI RIDER

Stack: **Vite 8 + TypeScript 7 (strict) + three.js r186 + postprocessing (pmndrs)**, WebAudio (procedural, no audio files),
DOM/CSS UI overlay (no framework), Blender 4.5 (Python, headless) for every 3D model. Fonts: Kanit (@fontsource/kanit) + Pretendard.

## Hard rules (all agents)
- `.ts` files ≤ 200 lines (data tables/prompt strings excepted) and ONE responsibility each. No `utils.ts`/`helpers.ts` dumping grounds.
- No `any`, no placeholder code (`TODO`, `Not implemented`), no stray `console.log` (use `console.warn/error` only for real problems).
- Import shared contracts from `src/core/**` — never redefine `Vec2`, `PlayerState`, events, etc. If a contract is missing something,
  add it in the narrowest compatible way (new optional field / new event) and say so in your report.
- Conventions for axes/heading/left-right: `src/core/types/geometry.ts` + helpers in `src/core/math2d.ts`. Thailand drives on the LEFT.
- Determinism: anything procedural takes an `Rng` (src/core/rng.ts) derived from `RunConfig.seed` via `rng.fork('<system>')`.
- Every module owns its THREE resources and exposes `dispose()`.
- Performance target: 60 fps on an Intel Arc iGPU at 1280×720 on the `medium` preset. Use InstancedMesh / merged geometry for repeated
  static things, avoid per-frame allocation in hot loops, keep draw calls < 400.
- `npx tsc --noEmit` must pass for your files. Ignore errors in files owned by other agents running in parallel.

## Folder ownership
```
src/core/            contracts (types, events, math2d, rng, config/*)     — orchestrator; extend minimally
src/engine/          renderer, post FX, quality, loop, environment (sky/sun/fog per time of day), assets, input
src/world/           city generation (pure data), CityQuery, city scene building (roads, markings, buildings, props, BTS, wires)
src/physics/         OBB SAT, spatial hash, collision resolution, clearance + near-miss sensing
src/player/          bike physics, rider/bike/passenger visual rig + loadout application, POV cockpit
src/camera/          camera rig (auto/diorama/squeeze/pov/event shots, shake)
src/traffic/         NPC vehicles (IDM, lanes, signals, motorbike filtering), pedestrians, traffic visuals   [WF-2]
src/mission/         job flow, navigation (A*), route line + markers, passenger comfort, story events, run stats [WF-2]
src/weather/         weather timeline → environment, rain/haze/splash FX, wet road                         [WF-2]
src/logic/           pure game logic: save store, economy, scoring, comfort model, style/combo, jobs, forecast, dialogue
src/audio/           procedural WebAudio engine, music sequencer, bus bindings
src/ui/              design system CSS, screen router + transitions, all screens, HUD
src/app/             top-level state machine wiring everything (BOOT→TITLE→…→RESULTS)                       [WF-3]
src/sandbox/         per-module dev harnesses (one entry per sandbox/*.html)
blender/             asset pipeline (lib/ + assets/<group>/*.py) → public/assets/models/*.glb
```

## Module public APIs (what other modules may call)
**engine** — `Engine` (`renderer`, `camera`, `setScene(scene)`, `setQuality(preset)`, `resize()`, `render()`, `post: PostFx`),
`PostFx.set({ tiltShift, focusY, bloom, vignette, saturation, warmth, exposure, wet })`, `GameLoop` (fixed 60 Hz step + render callback,
clamps long frames), `Environment` (`setTimeOfDay(tod, blendSec)`, `setWeather({ overcast, rain, haze })`, `update(dt, focus: Vector3)`,
`night` 0..1, `sun`, `lampsOn`), `Assets` (`preload(names, onProgress)`, `instance(name)` = deep clone with per-instance materials,
`shared(name)` = clone sharing materials, `has(name)`), recolour helpers (`setColor(root, materialName, hex)`, `setEmissive(...)`,
`findNode(root, name)`), `Input` (`poll(): PlayerInput`, `setTouchControls(visible)`).

**world** — `generateCity(seed, district): CityData` (pure, deterministic), `createCityQuery(data): CityQuery`,
`buildCityView(data, ctx): CityView` (`root: THREE.Group`, `update(dt, { night, wet, camPos, focus, signal(nodeId) })`, `dispose()`;
pass the rider position as `focus` every frame — cables, foliage and anything above head height dissolve where they
would hide the rider, and overhead geometry within ~6 m of an elevated chase camera melts away),
`DISTRICTS[id]` (labels, palette, signage words, landmark kinds). CityQuery also answers `roofAt(x, z)` (RoofMap: building
roof heights incl. 2 m balcony/awning reach) and `ceilingAt(x, z)` (CeilingMap: BTS deck / station undersides) for cameras.

**physics** — `obbOverlap(a, b) → { normal, depth } | null`, `obbCircleOverlap`, `obbGap(a, b)` (separation distance),
`SpatialHash<T>`, `CollisionSystem.resolve(player, city, traffic) → ContactReport[]` (pushes the player out, reports kind/heavy/speed),
`ClearanceSensor.sense(player, city, traffic) → ClearanceInfo`, `StyleSensor` (near-miss / perfect gap / filter-pass detection → bus).

**player** — `BikePhysics(stats)` (`state: PlayerState`, `step(dt, input, env: { grip, surfaceAt, extraWidth })`, `impulse(v)`,
`fall(reason)`, `teleport(pos, heading)`), `RiderRig` (THREE group: bike + rider + optional passenger, `applyLoadout(loadout)`,
`setPassenger(profile | null, { poncho, mask })`, `update(dt, state)`, `poses: 'ride' | 'idle_feet_down' | 'board' | 'fallen'`),
`PovCockpit` (`attach(camera)`, `update(state, speedKmh)`); first person swaps in `PovArms` (sleeves + gloves clenched on
the bike's `grip_L`/`grip_R`) via `RiderRig.setFirstPerson`.

**camera** — `CameraRig(camera)` (`mode`, `setMode(m)`, `update(dt, player, clearance) → { tiltShift, focusY }`, `shake(s, d)`,
`eventShot(kind, target, seconds)`, `orbit(target, t)` for title/garage). `setWorld(cityQuery)` once per run: `DioramaYaw` picks
the diagonal yaw offset that keeps the boom over open street, `CameraClip` keeps it out of buildings (roofAt) and below
the BTS deck (ceilingAt).

**traffic** — `TrafficSystem implements TrafficQuery` (`update(dt, player, intensity)`), `TrafficView` (instanced/cloned meshes),
`Pedestrians`.
**mission** — `MissionController` (`phase`, `update(dt, ctx)`, `hud(): Partial<HudState>`, `result(): RunResult`),
`Navigator` (A* over lanes/connectors, `route(from, to)`, progress), `RouteLine` (cyan dashed ribbon with chevrons), `TargetPin`.
**weather** — `new WeatherSystem(plan, ctx: WeatherCtx)` with ctx `{ env, scene, camera, quality, rng, bus?, city?, traffic?, trafficView?, rider?, glossy? }` (`update(dt, tripProgress)` BEFORE env.update, `state`, `wetness`, `lensWet(pov)`, `emitExhaust(pos, heading, strength)`, `trigger(kind)`, `setQuality(q)`, `dispose()`); see src/weather/index.ts.

**logic** — `loadSave()/persist(save)`, `buy(save, id)`, `startRun(save)`, `applyPayout(save, result)`, `computeResult(config, job, stats)`,
`ComfortModel`, `StyleTracker`, `generateOffers(city, rng, intensity, tripNumber)`, `rollForecast(seed, tripNumber)`, `say(rng, situation, trait)`.

**audio** — `AudioEngine` (`unlock()`, `setVolumes`, `engine.set(rpm01, throttle, load)`, `horn(on)`, `sfx(name, opts)`, `ui(name)`,
`ambience({ city, rain, wind, night })`, `thunder(distance)`, `music(track | null)`), `bindAudio(audio, bus)` maps GameEvents → sounds.

**ui** — `UI(root)`: `show(id, props, transition)` returns a `ScreenHandle` (`update(partialProps)`, `close()`), `hud.update(HudState)`,
`hud.flash(...)`, `toast(text, tone)`, `transition(kind)` promise. Screen prop contracts: `src/core/types/screens.ts`.

## PLAY frame order (src/app, WF-3)
1 `input.poll()` → 2 fixed-step: `bike.step` → `collisions.resolve` → `clearance.sense` + `style` → 3 `traffic.update` →
4 `mission.update` (navigation, prompts, comfort) → 5 `weather.update` → env → 6 visuals (`rig`, `trafficView`, `cityView`, FX) →
7 `cameraRig.update` → `post.set` → 8 `engine.render()` → 9 `ui.hud.update(state)`.

## Coordinates & units
Metres, seconds, radians. Speeds m/s internally, km/h only for display (`KMH` in math2d). three.js world = XZ ground, Y up.
Models: forward +Z in three.js (Blender −Y). Sim heading θ ↔ `object.rotation.y = θ`.

## Dev harnesses
Each module ships `sandbox/<module>.html` + `src/sandbox/<module>.ts`. Check them headless:
`node tools/shot.mjs --page sandbox/<module>.html --steps "wait:3000,shot:<name>,hold:KeyW:2000,shot:<name2>"`
(no leading slash on --page under Git Bash). Look at the PNGs in `shots/` with the image Read tool.
