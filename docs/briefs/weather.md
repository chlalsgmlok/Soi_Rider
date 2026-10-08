# Brief: weather

Read docs/briefs/_common.md FIRST (project, rules, tools, status).

OWNED PATHS: src/weather/**, sandbox/weather.html, src/sandbox/weather.ts

Build weather & atmosphere on top of src/engine Environment/PostFx and src/world CityView:
- WeatherSystem(plan: WeatherPlan, ctx): timeline driven by trip progress (WeatherEvent.atProgress) and time: base state (clear/haze/overcast) → downpour with a 6 s build-up (sky darkens via Environment.setWeather overcast, wind gusts, first drops, thunder) → full rain → taper → after-rain (wet roads drying slowly, steam wisps); haze spikes (yellow-grey smog density up, orange sun disc). Emits 'weather:change', 'thunder' (with flash: brief sky/ambient flash), exposes state { overcast, rain, haze, wetness, wind, lightning } for mission (rain/smog prompts), audio (bindAudio already listens) and the city view (update({ wet })).
- RainFx: GPU-cheap camera-local rain streaks (instanced / points with velocity stretch, wind slant), ground splash rings & ripples near the camera, drips off awnings (optional), spray particles behind moving vehicles/player wheels on wet roads (API to register emitters), puddle splashes when the player rides through puddleSpots from CityView ('splash' event, onPedestrian flag when a pedestrian is near → mission penalty), POV wet lens via PostFx wet param.
- HazeFx: drifting smog cards/particles near the ground, bus/truck exhaust puffs API (traffic calls emitExhaust(pos, dir)), heat shimmer at noon clear (cheap screen-space or skip if too costly), dust motes in sunbeams at sunset (subtle).
- Wet look: drive CityView/road material wetness (darker asphalt, lower roughness, reflections of lamps/neon approximations), vehicle paint glossiness up when wet.
- Quality scaling (particle counts by preset). Perf budget ≤ 1.5 ms GPU on medium.
- Sandbox sandbox/weather.html?seed=&tod=&weather=clear|haze|rain|storm&t= : city view + real traffic (src/traffic, finished) + the weather; keys to trigger a downpour/haze spike; window.__ready. Screenshots: sunset clear, downpour at dusk (should evoke mockup 02's wet neon reflections), haze at noon, night rain, POV wet lens.
Tests: timeline sequencing (events trigger at progress, durations, transitions), state ranges.

When finished, reply with: files created, public API (signatures), verification evidence (tsc/tests/screenshot paths + what you saw), known issues.
