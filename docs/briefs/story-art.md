# Brief: story-art

Read docs/briefs/_common.md FIRST (project, rules, tools, status).

OWNED PATHS: blender/story/**, public/assets/story/**

Render the story key art (comic-panel stills used by the intro, story prompts and results) in Blender 4.5 by importing the game's own GLBs (bpy.ops.import_scene.gltf from public/assets/models) and composing small dioramas, so the art is 100% consistent with the in-game look (mockup 03 style: toy-like cartoon 3D, golden hour, tilt-shift-ish shallow depth of field via camera DOF).
Read docs/GAME_DESIGN.md §3 (story) and look at docs/reference/*.png. Use blender/lib (bootstrap.start, palette) and write scripts in blender/story/. Run via node blender/run-blender.mjs blender/story/<script>.py (log printed; Store Blender launcher; EEVEE renders white headless here → use Cycles CPU, denoise, ~48–96 samples, 1600×900, threads 6). Output WEBP (scene.render.image_settings.file_format='WEBP', quality 88) to public/assets/story/<name>.webp plus a 640×360 thumb <name>_s.webp.
Pose characters by rotating the char_body joint objects (they are separate parented objects with joint pivots). Compose readable, emotional scenes with strong silhouettes, warm key light + cool fill, bounce, slight atmospheric haze:
1. story_title — hero key art: busy Bangkok intersection at sunset from a high 3/4 angle (taxis pink & green-yellow, white vans, blue tuk-tuk, bus, motos), the hero rider on the mint scooter in a cyan ring with a cyan dashed route curve painted on the road (emissive strip) heading to a coral pin; shophouses with awnings, bougainvillea, power poles with wires.
2. story_first_call — the rider sitting on the bike at the win stand (prop_win_stand) beside a khao-man-gai cart with Aunt Lek (char_body, apron, bun hair) waving; the rider looking at a glowing phone; morning light.
3. story_rain — sudden downpour at dusk: the rider stopped under a striped awning handing a yellow poncho (outfit_poncho) to the passenger; rain streaks (particles or thin emissive planes), wet reflective road with tail-light reflections.
4. story_haze — hazy noon: a bus puffing exhaust, the passenger coughing, the rider offering a mask (acc_mask).
5. story_arrival — night arrival with neon signs: the passenger waving goodbye in front of the destination, coins/notes motif, the rider giving a thumbs up.
6. story_garage — the rider's bike in front of a half-open shophouse shutter at night under a warm bulb (used as the garage screen backdrop alt / loading art).
Iterate: render low-res drafts (480×270, 16 samples) → Read them → fix composition/lighting/posing → final renders. At least 2 drafts per image. Write blender/story/README.md and a JSON manifest public/assets/story/manifest.json [{id, file, thumb, caption_ko}].

When finished, reply with: files created, public API (signatures), verification evidence (tsc/tests/screenshot paths + what you saw), known issues.
