# Wiring notes for src/app (collected by the orchestrator from each module's builder)

Always confirm against the module's `index.ts` and sandbox — these notes say WHAT to call and in which order.

## Fixed step (60 Hz) — order matters
1. `bike.step(dt, input, rideEnv)` (src/player; rideEnv grip from `gripFor(weather.wetness)`; feed `holdInput(speed, ride)` instead of player input while `mission.holdBike`)
2. `contacts = collisions.resolve(bike, cityQuery, traffic, dt)` → for each contact `bus.emit('collision', { kind, heavy, speedKmh, point, other })` (the mission does NOT emit it); heavy → `bike.fall(reason)` per physics rules
3. `traffic.update(dt, player, intensity)` (src/traffic) — `traffic.onExhaust = (e) => weather.emitExhaust(e.pos, e.heading, e.strength)`
4. `clearance.sense(bike, city, traffic)` · `publishStyle(style.step(dt, bike, clearance, contacts, traffic), tracker, bus)` · `tickStyle(tracker, dt, bus)` (src/physics)
5. `mission.update(dt, { player, interact, contacts, style: styleEvents, pedScares, weather: { rain, haze, downpour, hazeSpike }, traffic })` (src/mission)
6. `weather.update(dt, mission.tripProgress)` BEFORE `env.update` (src/weather sets Environment.setWeather itself)

## Per rendered frame
- `rig.update(frameDt, bike.state, { steer, brake, lamps: env.lampsOn, night: env.night })`
- `post = cameraRig.update(frameDt, bike.state, clearance.info)`; `loop.timeScale = cameraRig.timeScale`; `cameraRig.setWorld(cityQuery)` once per run (CityQuery.roofAt drives occlusion)
- `cockpit.setActive(cameraRig.povActive)`, `cockpit.update(bike.state, kmh, env.night)`, `cockpit.renderMirrors(renderer, scene)`
- `routeLine.setPath(mission.nav.path)` (cheap if unchanged) · `routeLine.update(dt, mission.nav.s, env.night)` · `markers.update(dt, mission, bike.state, camera, cameraRig.povActive)`
- `cityView.update(dt, { night: env.night, wet: weather.wetness, camPos, signal: (id) => traffic.signal(id) })` · `trafficView.sync(...)` (see src/traffic/index.ts)
- `engine.post.set({ ...envGrade, ...post, wet: weather.lensWet(cameraRig.povActive) })`
- HUD: `{ ...mission.hud(), targetScreen: markers.targetScreen(camera, w, h), clearance brackets projected from ClearanceInfo points, speedKmh, cameraMode, weather/rain from weather.state, roadName from cityQuery.roadNameAt }` → `ui.hud.update(state)`; see src/mission/dev/hud-frame.ts (HudFrame.build) for a working assembly.

## Events / hooks
- `player:fall` → `cameraRig.eventShot('fall', null, 2.3)` + `cameraRig.shake(0.8, 0.6)`
- MissionHooks: `board(p, sec)` → `await rig.board(...)` + `cameraRig.eventShot('boarding', null, 2.4)`; `dismount(p, sec)`; `care(poncho, mask)` → `rig.setPassenger(..., { poncho, mask })` and `weather.gloss.add(rig.root)`; `ended(kind)` → go to RESULTS. The app emits `'run:complete'` with the RunResult.
- End of run: `settleRun(save, mission.config, mission.job, mission.finalStats())` / `computeResult` + `applyPayout` + `persist` (src/logic).
- `engine.onQualityChange(q => weather.setQuality(q))`; after `applyLoadout` call `weather.gloss.add(rig.root)` again.
- Weather ctx: `{ env, scene, camera, quality, rng: rng.fork('weather'), bus, city: cityView, traffic, trafficView, rider: bike.state, glossy: [rig.root] }`.

## Scenes (src/app/scenes)
- `TitleScene.create(engine, assets, { loadout, timeOfDay: lastTripTod ?? 'sunset' })`; `GarageScene.create(...)` → `rotate(delta)` ← GarageProps.onRotate, `applyLoadout(l)` ← onPreview/onEquip.
- `IntroScene(engine, assets, { city: cityView, query, env, loadout, scene, rig, cameraRig, traffic: { system, view, intensity, probe } })` → on job accept `await intro.swoopToRide()`; then keep driving the SAME cameraRig, stop calling `intro.update`, `intro.dispose()` (it leaves city/env/traffic/rig alone).
- Each BackdropScene: `enter(engine)`, `update(dt)` once per frame before `engine.render()`, `exit()`, `dispose()`.

## Known cross-module issues to handle or report
- ETA covers spawn→pickup + pickup→drop (mission) — fine, just display it.
- Traffic: a queued NPC can deadlock at a junction (seen on seed 7, Asok Montri Rd / Soi Asok 3) — the traffic owner fixes it; the bot filters around it.
- tools/shot.mjs now scans only the captured page for deps (fewer "504 Outdated Optimize Dep"); if it still happens, rerun.
