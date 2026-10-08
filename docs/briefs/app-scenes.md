# Brief: app-scenes

Read docs/briefs/_common.md FIRST (project, rules, tools, status).

OWNED PATHS: src/app/scenes/**, sandbox/scenes.html, src/sandbox/scenes.ts

Build the 3D backdrops the app shows behind the non-ride screens (src/traffic is finished; read it):
- TitleScene: a living diorama — a generated signalised junction neighbourhood (generateCity with a fixed showcase seed, cropped view), CityView + TrafficSystem in 'rush' with motos weaving, golden-hour sunset Environment, CameraRig.orbit slow cinematic orbit/dolly at the mockup-03 angle with strong tilt-shift; subtle parallax with mouse; time-of-day can follow the save's last trip. Must look like mockup 03 behind the title UI.
- GarageScene: the rider's bike + rider (RiderRig with the current/preview Loadout) on a small turntable in front of a half-open shophouse shutter at night: warm bulb light, neon sign, potted plants, the win vest hanging, bounce light; camera framed so the bike sits in the LEFT ~55% of the screen (the garage UI panel docks right, ≤ 460 px); rotate(delta) API; applyLoadout(loadout) live with a little 'equip' bounce animation.
- IntroScene: the win stand at the run's spawn in the run's actual city (built by the session; accept CityView + spawn + Environment) — the rider idling on the bike, Aunt Lek's khao-man-gai cart, then the camera swoop from an establishing high shot down to the diorama chase position when the job is accepted (expose a promise-returning swoopToRide()).
- Each scene: { scene: THREE.Scene; enter(engine); update(dt); exit(); dispose() } and sets PostFx params.
- Sandbox sandbox/scenes.html?scene=title|garage|intro with screenshots; iterate visually ≥ 3× vs mockup 03 (title) — the title backdrop is the first impression of the game.

When finished, reply with: files created, public API (signatures), verification evidence (tsc/tests/screenshot paths + what you saw), known issues.
