# Shared brief for every SOI RIDER agent

PROJECT: "SOI RIDER" — a 3D Bangkok motorbike-taxi game (Vite 8 + TypeScript 7 strict + three.js r186 + pmndrs postprocessing; Blender 4.5 assets).
Project root: C:/Users/chlal/Desktop/cursorworkspace/playground/apps/soi-rider (Windows 11; Bash tool = Git Bash: cd to the root first).
Read first: docs/GAME_DESIGN.md, docs/ARCHITECTURE.md (HARD RULES + module APIs), docs/DESIGN_SYSTEM.md, docs/ASSET_SPEC.md, src/core/** (contracts).
STATUS (orchestrator, 2026-10-07 18:30): FINISHED and verified on disk — src/engine, src/world (gen + query + build/ city view: sandbox/city.html 115 fps / 16 draws), src/logic, src/audio, src/ui (foundation + HUD + ALL screens: sandbox/ui-play.html, sandbox/ui-menu.html), src/physics + src/player + src/camera (sandbox/player.html), src/traffic (TrafficSystem + TrafficView + pedestrians: sandbox/traffic.html — 80 agents, 0 overlaps, 140 fps), all Blender GLBs. Whole project: tsc clean, 359 vitest tests pass — keep it that way. Integration notes:
- Heading convention: sim heading grows to the LEFT; HudState.targetBearing is + = right → bearing = wrapAngle(heading - headingOf(target - pos)).
- Engine look-dev (sandbox/engine.html) matches mockup 03: reuse its Environment + PostFx settings.
- The org hit its spend limit twice during this project: be efficient (no redundant full-res renders or needless re-runs; keep screenshots targeted) without compromising quality.
Visual references: docs/reference/mockup-03-diorama.png (toy-like cartoon 3D Bangkok diorama, golden hour, tilt-shift, cyan dashed route, coral pin) and docs/reference/mockup-02-pov-rain.png (first-person squeeze between mirrors in rain, "( 6 cm )").
Quality bar: a polished commercial game. No placeholders/TODOs in your scope.
Parallel work: other agents edit other folders at the same time. Only edit your OWNED PATHS. Shared files (src/core/**, other modules) — change only if truly necessary, minimally and additively, and list it in contractChanges.
Tools: npx tsc --noEmit -p . (judge your files) · npx vitest run <path> · node tools/shot.mjs --page "sandbox/<x>.html?params" --dir shots/<key> --steps "until:30000:window.__ready|wait:500|shot:a|hold:KeyW:2000|shot:b|eval:JSON.stringify(window.__stats)" (no leading slash; steps split by | or ,) then LOOK at PNGs with Read · node tools/glb-inspect.mjs.
If you use hashline_edit, check its diff (it may drop lone closing-brace lines).
Report honestly with evidence.
