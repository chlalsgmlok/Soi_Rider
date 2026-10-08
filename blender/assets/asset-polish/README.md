# asset-polish: art-review must-fix pass (2026-10)

Fixes the nine must-fix items from the independent art review, so the hero assets match mockup 03 (chunky, rounded,
toy-like). The scripts stay in their own groups. This file says where each fix lives and how to rebuild it. Node
names, pivots and material names are unchanged unless noted, and every asset is within its budget.

| # | asset | script | tris / budget | size (three.js x × y × z, m) | nodes | what changed |
|---|---|---|---|---|---|---|
| 1 | `char_body` (hero) | `characters/char_body.py` | 2494 / 2500 | 0.75 × 1.68 × 0.34 | 15-node rig (unchanged pivots) | Pelvis rebuilt as a soft rounded box (14 segs) that fully swallows both thighs. Each thigh starts with a true hemisphere centred on its hip joint, so the crotch/buttock junction is one clean crease standing **and** seated (STOOL, RIDER). Limb lofts now wind outward (they were inside-out). Paid for by cheaper ears and toe caps, a 2-ring neck and a redundant torso ring. |
| 2 | `outfit_hood` | `characters/char_outfits.py` | 758 / 800 | 0.74 × 0.62 × 0.37 | `outfit_hood` + `sleeve_upper_L/R` (shoulder) + `sleeve_lower_L/R` (elbow) | Puffy fleece sleeve shells with gathered rib cuffs. The waistband now clears the new pelvis (+1 cm). Round 2: the game re-parents the sleeves onto the arm joints (player, NPCs, look-dev; see Runtime). |
| 2 | `outfit_jacket` | `characters/char_outfits.py` | 800 / 800 | 0.75 × 0.66 × 0.31 | as hood | Sleeves with white `Outfit_Trim` rib cuffs and twin white stripes from shoulder to cuff (classic track jacket; the chest stripes moved here). The hem clears the pelvis. Zip and welts are facet-exact raised strips. |
| 3 | `veh_tuktuk` (hero) | `vehicles_thai/veh_tuktuk.py` | 3490 / 3500 | 1.59 × 1.90 × 3.00 | unchanged | Quilted canopy: 6 padded cushions with creased seams (pinched 3 cm in, 6 cm down), flat-topped crowns, rounded nose and tail, `Paint2` rim stripe all round, one valance scallop per cushion. Post tops are tucked under the rim. |
| 4 | `bts_train` | `vehicles_thai/bts_train.py` | 3174 / 3500 | 3.00 × 3.76 × 22.0 | unchanged | Shell is 21.72 × 2.94 (HL 10.86, HW 1.47). Anticlimbers, gangway, panes and gutters stand proud of it, so the car now fits 22.0 × 3.0 exactly (it was 22.27 × 3.06). |
| 5 | `prop_food_cart` (hero) | `props_street/food_cart.py` | 890 / 900 | 1.82 × 2.89 × 1.74 (x −0.99..0.83, z −1.01..0.74) | single mesh | The umbrella shaft rises behind the glass case and leans 8° toward the customer side. The 0.85 m canopy sits over the cart footprint (it used to reach 1.75 m behind the origin). Wheels are 14-seg. Paid for by single-quad decals, one-sided hubs, a 6-seg pot and a 5-seg bulb. Round 2: canopy 0.2 m higher so a length of shaft shows above the sign board; two plump smooth roast chickens (36 tris each) instead of three 20-tri crystals. |
| 6 | `prop_umbrella`, food-cart canopy | `props_street/furniture.py`, `lib/props_street_puffy.py` | 780 / 900 | 2.78 × 2.80 × 2.78 | single mesh | New `puffy_canopy()`: 5 radial rings (cart: 4; both had 2). Each panel is inflated along the dome normal and the rim is scalloped. Fabric is exempt from the kit's face-area weighted normals (they faceted it), and the canopy now faces outward. |
| 7 | `prop_bougainvillea` | `props_street/plants.py` | 870 / 900 | 1.29 × 1.42 × 1.22 | single mesh | Rain-tree style: one soft noise-displaced `Leaf` mass. Round 2: eight smaller smooth `Flower` sprays (35-tri lumpy domes ray-cast onto the real mass surface, clumped on the street side and the top) plus three sprays tumbling over the front rim, instead of 3-4 big pads. One colour per mass, smooth normals, no gem balls. |
| 8 | `prop_win_stand` (hero) | `props_infra/prop_win_stand.py`, `lib/props_infra_stand_parts.py` | 897 / 900 | 3.00 × 3.22 × 1.80 | `body`, `sign_face` @ (0, 2.89, 0.75) | Vests have wide flat shoulders and a shallow neck (no cat-ear notches), big cream bibs and bold digits. The stool is a real Thai stool: a round rolled-rim seat on a flared skirt with 4 arched cut-outs, in `Plastic`. Paid for by 6-sided posts, 5-seg rails and buried faces culled. Round 2: vest rail 0.22 m lower (1.90 m) so bibs 2-4 read under the roof fascia from the diorama camera; stool legs end in wide flat feet (no points). |
| 9 | `veh_taxi` | `vehicles_cars/veh_taxi.py`, `lib/vehicles_cars_taxi.py` | 3470 / 3500 | 2.04 × 1.64 × 4.59 | unchanged (mirrors kept large) | The taxi now has its own toy shell: a crowned hood into a fat round nose, chunky rounded bumper corners, barrel flanks (lean 0.88 on a t^1.7 curve), rounder plan corners and a bubble cabin (top 0.75, bevel 0.16, bigger roof radii). Round 2: lamps, bezels, reflectors and the amber pieces are refitted to that shell with corner casts (no spikes to the wheel arch, no lifted or buried corners, no amber speck through the lens); hood/boot shut lines moved onto the flat panels. |

Empties and nodes were verified with `tools/glb-inspect.mjs` after export: sleeve offsets, `sign_face`, mirrors,
wheels and lights. No new empties were added. The sleeves are mesh nodes parented with an explicit identity
parent-inverse.

New helper files (new files only; no shared lib was edited):
- `lib/characters_sleeves.py`: sleeve shells, `facet_point` / `limb_point` (exact placement on faceted lofts) and
  `strip` (6-tri/segment raised stripes). It also holds the sleeve re-parent rule that the posed preview uses.
- `lib/props_street_puffy.py`: `puffy_canopy()` and `soft_normals()`.
- `lib/props_infra_stand_parts.py`: win-stand vests (new outline, bigger bib and digits) and the arched Thai stool.
- `lib/vehicles_cars_taxi.py` (round 2): `corner_cast()` (straight rays across the flat nose/tail, rays swinging round
  a vertical axis at each corner), `slab()` (kit `patch()` without the road-facing bottom wall), rounded `lamp()`,
  and the taxi's own `front_details`, `side_details`, `rear_details`, `lights`.

## Runtime notes
- **Sleeves are re-parented in game code** (round 2; the first pass wrongly claimed nothing broke: both the player
  loadout and the NPC rig attached hood / jacket whole to `torso`, so the sleeves hung in the A-pose with white cuffs
  at hip height while the arms reached for the grips). The rule is `src/engine/assets/outfit-sleeves.ts`
  (`SLEEVE_JOINTS`, `fitSleeves`), used by:
  - `src/player/rig/loadout.ts`: after attaching the hoodie / track jacket, each `sleeve_*` moves onto
    `arm_*` / `forearm_*` with a zero local transform. `Dressing.sleeves` keeps them for recolouring and release;
    `povHidden()` hides the upper sleeves in first person (the forearm sleeves stay on the grips).
  - `src/traffic/view/character-rig.ts` (NPCs; 28 % of riders wear the jacket, 10 % the hood): the torso part
    skips `sleeve_*`; each sleeve is its own instanced part, written at that person's `world[J.arm_L]`,
    `world[J.forearm_L]`, ... with the outfit tint.
  - `src/engine/lookdev/lookdev-rider.ts`: `buildRider` calls `fitSleeves` (it only uses the vest today).
  Tests: `src/engine/assets/outfit-sleeves.test.ts` (posed sleeves equal the joint matrices) and
  `src/traffic/view/character-rig.test.ts` (sleeve instances equal the posed arm / forearm instances; the torso
  part no longer carries the A-pose sleeves). See `characters/README.md` § Attachments.
- The kit `finish()` in props_street / vehicles_cars uses face-area weighted normals (weight 50). That keeps blocks
  flat but facets curved fabric, so canopies opt out through `soft_normals()`.

## Rebuild (from apps/soi-rider; body first, because outfit previews import char_body.glb)
```
node blender/run-blender.mjs blender/assets/characters/char_body.py
node blender/run-blender.mjs blender/assets/characters/_pelvis_qa.py
node blender/run-blender.mjs blender/assets/characters/char_outfits.py --only=outfit_hood,outfit_jacket
node blender/run-blender.mjs blender/assets/vehicles_thai/veh_tuktuk.py
node blender/run-blender.mjs blender/assets/vehicles_thai/bts_train.py
node blender/run-blender.mjs blender/assets/props_street/food_cart.py
node blender/run-blender.mjs blender/assets/props_street/furniture.py --only prop_umbrella
node blender/run-blender.mjs blender/assets/props_street/plants.py --only prop_bougainvillea
node blender/run-blender.mjs blender/assets/props_infra/prop_win_stand.py --angles
node blender/run-blender.mjs blender/assets/vehicles_cars/veh_taxi.py           # lamps via lib/vehicles_cars_taxi.py
node blender/run-blender.mjs blender/assets/asset-polish/_taxi_lamp_qa.py     # lamp close-ups (round 2)
node blender/run-blender.mjs blender/assets/characters/char_assembly.py      # seated QA with the new body
```

## QA images
- Cycles: `blender/previews/char_body*.png`, `outfit_hood.png`, `outfit_jacket.png`, `outfit_sleeves__posed.png`,
  `veh_tuktuk*.png`, `bts_train*.png`, `prop_food_cart.png`, `prop_umbrella.png`, `prop_bougainvillea.png`,
  `prop_win_stand.png` (+ `shots/props_infra/prop_win_stand_0..4.png`), `veh_taxi*.png`, `char_assembly*.png`.
- three.js sandbox: `shots/asset-polish/tuktuk_diorama.png`, `taxi_tuktuk_diorama.png`, `cart_umbrella_diorama.png`,
  `street_props_diorama.png`, `win_stand_diorama.png`, `win_stand_front.png`, `characters_front.png`.
- Round 2: `blender/previews/veh_taxi__qa_{front,rear}_{L,R,low}.png` (lamp close-ups); `shots/asset-polish-r2/`:
  `taxi_{diorama,side,front}.png` + `crop_taxi_*.png`, `cars_lineup.png`, `player_jacket_{idle,ride,pov}.png`,
  `player_hoodie_ride.png` + `crop_player_*.png`, `win_diorama.png`, `boug_diorama.png` + `crop_boug.png`,
  `cart_{diorama,front}.png`.
