# props_infra — street infrastructure props

Procedural Blender 4.5 scripts that build the SOI RIDER street-infrastructure props in the mockup-03 toy
diorama style and export `public/assets/models/<name>.glb` (+ preview `blender/previews/<name>.png`).
Shared group helpers: `blender/lib/props_infra_kit.py` (lathe / tube / extrude / shell / uv_quad / catenary
builders) and `blender/lib/props_infra_preview.py` (contract preview + optional QA angles).

## Rebuild

```bash
cd apps/soi-rider
node blender/run-blender.mjs blender/assets/props_infra/<asset>.py            # GLB + preview
node blender/run-blender.mjs blender/assets/props_infra/<asset>.py --no-preview
node blender/run-blender.mjs blender/assets/props_infra/<asset>.py --angles   # + QA angles -> shots/props_infra/<asset>_<i>.png
node blender/run-blender.mjs blender/assets/props_infra/_group_preview.py      # blender/previews/props_infra_group.png
node tools/glb-inspect.mjs public/assets/models/<asset>.glb
node tools/shot.mjs --page "sandbox/models.html?models=prop_win_stand,prop_spirit_house&view=diorama" --dir shots/props_infra --steps "until:30000:window.__ready|shot:check"
```

Run `_group_preview.py` after the asset scripts (it imports the exported GLBs; it writes no GLB).

## Orientation

Blender Z-up, metres, origin on the ground at the footprint centre. The model's front is −Y in Blender
(+Z in three.js) and faces the road. +X in Blender is the model's LEFT and stays +X in three.js. This matches
the runtime placeholders (`src/engine/assets/placeholders/props-infra.ts`) and the lookdev placements
(`FACE_W` = −π/2 on the east kerb).

## Assets

Sizes are three.js axes x × y(up) × z(forward). Budget ≤ 900 tris each (enforced by `export_glb(max_tris=900)`).

| asset | tris | size (m) | nodes (contract) | notes |
|---|---|---|---|---|
| prop_power_pole | 892 | 1.33 × 9.06 × 2.03 | `body`, empties `wire_0`..`wire_3` | Tapered square concrete pole with black/white base bands. Two steel crossarms run across the street (Blender Y) with braces. Four big porcelain pin insulators carry empties at their tips: `wire_0`/`wire_1` on the upper arm (street side −Y / building side +Y) and `wire_2`/`wire_3` on the lower arm, so runtime catenaries between poles run along the road. Also: pole-top transformer with fins, bushings and drop leads; telecom box with conduit; cable coil; step pegs; yellow number plate. |
| prop_street_lamp | 786 | 0.79 × 8.22 × 3.08 | `body`, empty `lamp` | 8 m chunky lamp with a swan-neck arm reaching ~2 m over the road (−Y) and a scroll brace. The puffy cobra head has a `Lamp_Glow` lens underneath (emissive), and the `lamp` empty sits just under the lens. Concrete footing, access door, yellow/black reflective bands. |
| prop_traffic_light | 898 | 5.32 × 6.62 × 0.98 | `body`, `lamp_red`, `lamp_amber`, `lamp_green`, `countdown` | Mast arm reaches 5 m along +X over the road. The overhead head and the pole repeater head, the lenses (`Signal_Red/Amber/Green`, emissive colour, base dimmed) and the `countdown` quad (`Sign_Face`, UV 0..1, dark base) all face −Y (three.js +Z). Each lamp node holds both heads' lenses, with its origin at the overhead lens centre. Also: tie rod, yellow-rimmed backplates, visors, pedestrian push button. |
| prop_soi_sign | 754 | 1.30 × 3.29 × 0.42 | `body`, `sign_face` | Dark decorative post with gold rings, finial and stepped base (mockup 03, top-left). White-rimmed plate. `sign_face` is two quads (front −Y and back +Y, `Sign_Face` blue base, UV readable from both sides). Flyers stuck on the post. |
| prop_spirit_house | 883 | 1.04 × 2.69 × 1.01 | `body` | San phra phum: white stepped square pillar with gold rings flaring into a red deck, and a gold balustrade. Gold shrine with red door frame and porch columns. Two stacked steep red gables with gold pediments, bargeboards with hang-hong curls and chofa horns, and a gold spire. Marigold swag with tails, jasmine porch swag, red soda bottles with straws, incense bowl, two dancer figurines. |
| prop_bus_stop | 844 | 4.55 × 3.00 × 1.93 | `body`, `sign_face` | BMTA-style shelter: curved white canopy, blue frame, glass back with route map, wooden bench, backlit gram ad (cyan + coral pin), bus-stop flag pole. `sign_face` = route plate under the bus pictogram (both sides, ±X). |
| **prop_win_stand** (hero) | 897 | 3.00 × 3.22 × 1.80 (three.js x × y × z) | `body`, `sign_face` @ (0, 2.89, 0.75) | Motorcycle-taxi stand. Paving slab, four dark posts, puffy pitched blue roof with raised white corrugation ribs and an orange front lip. Orange rounded crest sign on the front edge carries `sign_face` (quad facing −Y, `Sign_Face` cream, UV 0..1, meant for "วิน"). Wooden bench with backrest; four orange rider vests on the back rail (rail at 1.90 m, so the bibs clear the roof fascia from the diorama camera), plus one on the front-right post so a vest is visible from the high camera: wide flat shoulders and a shallow neck (no cat-ear notches), big cream bibs (0.32 × 0.38 m) with bold modelled pixel digits 1-4 / 7. Chalk-black queue board with numbered tags on the right side (−X), fare board with route lines on the left side (+X), red `Plastic` Thai stool (round 14-seg rolled-rim seat on a flared skirt with four arched cut-outs = four splayed legs with wide flat feet, like `prop_stool`), cyan helmet on the bench, gram sticker on the front-left post. |
| prop_barrier | 448 | 1.55 × 0.85 × 0.54 | `body` | Jersey water barrier, long axis X. Body uses the shared `Paint` material (red), so the runtime can alternate red/white units. Raised white `Reflector` strips, fork-pocket arches, grip slot, fill cap, interlocking knuckles (`Trim`). |
| prop_hydrant | 827 | 0.55 × 0.87 × 0.53 | `body` | Chunky red pillar hydrant on a concrete pad: white reflective band, yellow dome cap with pentagon nut, steel outlet caps on chains (pumper faces −Y), bolted flange. |

## Materials

Contract names used: `Sign_Face`, `Signal_Red/Amber/Green`, `Lamp_Glow`, `Paint` and `Trim` (barrier),
and `Plastic` (win-stand stool). All other materials have group-local names (`Steel`, `Gold`, `Vest_Orange`, …)
and fixed colours from `blender/lib/palette.py`.

## Previews

- Per asset: `blender/previews/<asset>.png`. QA angles: `shots/props_infra/<asset>_<i>.png`.
- Group: `blender/previews/props_infra_group.png`.
- Game renderer: `shots/props_infra/game_small_diorama.png`, `game_tall_diorama.png`, `game_front.png`,
  `game_side.png`, `lookdev_diorama.png`.
