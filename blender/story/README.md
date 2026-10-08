# Story key art (Blender → WEBP)

Six comic-panel stills rendered from the game's own GLBs (`public/assets/models`), so the art matches the in-game look.
Output: `public/assets/story/<id>.webp` (1600×900) + `<id>_s.webp` (640×360 thumb), listed in `public/assets/story/manifest.json`
(the app's `src/app/story/` loads the manifest and only shows a panel once its image has loaded).

| id | scene | used in |
|---|---|---|
| story_title | sunset Sukhumvit junction, NONG in the cyan gram ring, route to the coral pin | key art |
| story_first_call | Soi 23 win stand in the morning, first gram call, Aunt Lek waves from her khao-man-gai cart | intro (gram phone) |
| story_rain | sudden downpour, NONG hands the passenger a yellow poncho under an awning | raincoat prompt |
| story_haze | bus exhaust, the passenger coughs, NONG offers a mask | mask prompt |
| story_arrival | neon night arrival at HOSTEL 23, wave + tip coins | arrival |
| story_garage | night shophouse shutter, warm bulb, the Kitti 125 resting | garage / loading art |

The hero (NONG) is defined once in `kit/cast.py` (`HERO_LOOK`, `hero()`): white open-face helmet, orange win vest over a white
tee, denim — keep every scene consistent by changing him only there.

## Rebuild
```bash
# one draft (480×270, 16 samples) → blender/story/drafts/<id>__<tag>.png
node blender/run-blender.mjs blender/story/story_rain.py --draft --tag=d1
# one final (1600×900 WEBP + thumb, ~5–10 min on CPU)
node blender/run-blender.mjs blender/story/story_rain.py
# all six finals, detached (≈ 55 min)
nohup bash blender/story/render-all.sh > blender/logs/story-finals.log 2>&1 &
```
Cycles CPU is used because EEVEE renders blank headless on this machine (Intel Arc iGPU, Store Blender launcher).
Shared helpers live in `kit/` (assets loader, cast/posing, street dressing, fx, look/render settings, post/output).
