# characters — SOI RIDER people kit

Chunky toy-diorama people (mockup 03): one segmented body plus head and torso attachments. Every attachment is
built against the same landmarks (`blender/lib/characters_rig.py`). Parent it to the named body node with a ZERO
offset and it fits. Blender Z-up and metres, facing −Y (three.js +Z). The model's LEFT is +X.

## Assets

| GLB | tris / budget | size x×y×z (three.js, m) | nodes / pivot | materials |
|---|---|---|---|---|
| `char_body` | 2494 / 2500 | 0.75 × 1.68 × 0.34 | 15-node segmented rig (below) | `Skin`, `Hands`, `Shirt`, `Pants`, `Shoes` + fixed `Sole`, `Eye`, `Eye_Shine`, `Blush`, `Hair` (eyebrows) |
| `hair_short` | 416 / 800 | 0.30 × 0.31 × 0.31 | 1 mesh, origin = `head` joint | `Hair` |
| `hair_long` | 448 / 800 | 0.32 × 0.47 × 0.30 | idem | `Hair` |
| `hair_bun` | 472 / 800 | 0.30 × 0.35 × 0.33 | idem (low bun sits under every helmet rim) | `Hair`, `Hair_Tie` |
| `hat_cap` | 688 / 800 | 0.38 × 0.30 × 0.44 | idem (short hair under the cap) | `Hat`, `Hair`, `Hat_Logo` |
| `acc_mask` | 408 / 800 | 0.33 × 0.19 × 0.20 | idem (surgical mask + ear loops) | `Mask` |
| `helmet_open` | 660 / 800 | 0.41 × 0.40 × 0.48 | idem (open face, peak, vents, chin strap) | `Helmet_Paint`, `Helmet_Trim`, `Helmet_Stripe` (red) |
| `helmet_full` | 756 / 800 | 0.44 × 0.42 × 0.43 | idem (chin bar, smoke visor + hinges, spoiler) | `Helmet_Paint`, `Helmet_Trim`, `Visor`, `Helmet_Stripe` (cream) |
| `helmet_half` | 752 / 800 | 0.41 × 0.40 × 0.44 | idem (bowl, goggles on strap) | `Helmet_Paint`, `Helmet_Trim`, `Visor`, `Goggle_Frame` |
| `helmet_cat` | 788 / 800 | 0.58 × 0.48 × 0.41 | idem (flat cat ears, whiskers) | `Helmet_Paint`, `Helmet_Trim`, `Cat_Ear_Inner` |
| `outfit_vest` | 704 / 800 | 0.39 × 0.45 × 0.32 | 1 mesh, origin = `torso` joint | `Outfit_Paint`, `Outfit_Trim` (reflective stripes) + `Vest_Patch`, `Vest_Number` ("23" on the back) |
| `outfit_hood` | 758 / 800 | 0.74 × 0.62 × 0.37 | root mesh (origin `torso` joint) + 4 sleeve nodes `sleeve_upper_L/R`, `sleeve_lower_L/R` (see Attachments); hood folded on the back, drawstrings, kangaroo pocket, puffy fleece sleeves with gathered rib cuffs | `Outfit_Paint`, `Outfit_Trim` (drawstrings) |
| `outfit_jacket` | 800 / 800 | 0.75 × 0.66 × 0.31 | root mesh + 4 sleeve nodes (as hood); track jacket: stand collar with white tipping, zip + pull, white rib hem, pocket welts, sleeves with white `Outfit_Trim` rib cuffs and twin white stripes shoulder-to-cuff | `Outfit_Paint`, `Outfit_Trim` |
| `outfit_poncho` | 468 / 800 | 0.86 × 0.70 × 0.58 | idem + **morph target `seated`** | `Poncho`, `Poncho_Snap` |

Materials that are not contract names (`Sole`, `Eye`, `Helmet_Stripe`, `Vest_Patch`, ...) are fixed accent
colours. The body's eyebrows use `Hair` on purpose, so recolouring `Hair` on the whole character also recolours
the brows.

## Body rig (`char_body`)

All rest rotations are identity, so a pose is just a set of local rotations. Joint positions are in metres,
three.js axes (x, y, z):

```
hips (0, 0.92, 0) root ─ torso (0, 1.00, 0) ─ head (0, 1.36, 0)           <- head attachments
                       │                    └ arm_L (0.18, 1.29) ─ forearm_L (0.247, 1.039) ─ hand_L (0.309, 0.807)
                       │                    └ arm_R (mirrored, -x)                                <- torso attachments on `torso`
                       └ thigh_L (0.095, 0.855) ─ shin_L (0.095, 0.47) ─ foot_L (0.095, 0.085)   (same _R at -x)
```

- Neutral A-pose: the arms hang 15° out. The head is 0.30 m tall (≈1/5.5 of 1.68 m), with the face on the −Y / +Z side.
- `Shirt` covers the torso and both arm segments (long sleeves). Hoodie and jacket bring their own sleeve shells
  (see Attachments), so `Shirt` no longer has to be recoloured to fake their sleeves.
- Pelvis (polish pass): `hips` is a soft rounded box that fully swallows both thigh ball-caps. Each thigh starts with a
  true hemisphere centred on its hip joint (rotation-invariant), so in every pose the thighs leave the pelvis through
  its underside (standing) or front (seated) at steep angles: one clean crease, no grazing zig-zag "briefs" line.
  Limb lofts are now wound outward (the old arms/legs were inside-out, hidden by double-sided materials).
- `Hands` is separate from `Skin`, so it can become gloves (the assembly preview's rider uses black gloves).

### Reference poses (`blender/lib/characters_pose.py`)

The X rotation has the same sign in Blender and three.js. Signs: torso/head +x leans forward; thigh −x swings
forward; shin +x bends the knee; arm −x reaches forward; `thigh_L` Blender −y (three.js +z) splays outward.

| pose | key rotations (rad) |
|---|---|
| `RIDER` | torso 0.22, head −0.12, thigh −1.25 (splay 0.12), shin 1.15, foot 0.1, arm −1.0, forearm −0.45 (matches `src/engine/lookdev/lookdev-rider.ts`) |
| `PILLION` | torso 0.06, thigh −1.30 (splay 0.22), shin 1.25, arm −0.12 (tucked 0.12), forearm −0.62: hands rest on the knees, under a seated poncho |
| `STOOL` | thigh −1.52, shin 1.48, arm −0.55, forearm −0.95; hips = stool top + 0.155 |

Seating: hips = `seat_rider` / `seat_pillion` + 0.04–0.05 m. The scooter grips are reached with `RIDER` as is.

## Attachments

- Head items: `body.getObjectByName('head').add(item)`. Torso items: same, on `torso`. No offset or rotation.
- **Sleeves (outfit_hood, outfit_jacket)** ship as four extra child nodes of the outfit root. After adding the outfit
  to `torso`, move each sleeve onto its body joint with a ZERO local transform so it follows the arm:

  | sleeve node | origin | re-parent to |
  |---|---|---|
  | `sleeve_upper_L` / `sleeve_upper_R` | shoulder joint | `arm_L` / `arm_R` |
  | `sleeve_lower_L` / `sleeve_lower_R` | elbow joint | `forearm_L` / `forearm_R` |

  ```ts
  import { fitSleeves } from '../engine/assets/outfit-sleeves';
  const outfit = assets.instance('outfit_jacket');
  body.getObjectByName('torso')!.add(outfit);
  const sleeves = fitSleeves(outfit, body);   // moves sleeve_* onto arm_* / forearm_*, zero local transform
  ```
  The rule lives in one place, `src/engine/assets/outfit-sleeves.ts` (`SLEEVE_JOINTS`, `fitSleeves`), and every
  runtime path uses it:
  - **Player** (`src/player/rig/loadout.ts`): `dressRider` re-parents the sleeves right after attaching the hoodie /
    track jacket and keeps them in `Dressing.sleeves`, so they are recoloured, released with the outfit, and the
    first-person view hides the upper sleeves (the forearm sleeves stay on the grips) via `povHidden`.
  - **NPCs** (`src/traffic/view/character-rig.ts`): the instanced torso part of each outfit skips `sleeve_*`; every
    sleeve becomes its own instanced part, built in its joint frame and written at `world[J.arm_L]`,
    `world[J.forearm_L]`, ... of the same person with the outfit tint.
  - **Look-dev riders** (`src/engine/lookdev/lookdev-rider.ts`): `buildRider` calls `fitSleeves` after attaching.
  Tests: `src/engine/assets/outfit-sleeves.test.ts`, `src/traffic/view/character-rig.test.ts`.
  Their exported local transforms equal the arm / forearm transforms relative to `torso` (sleeve_upper_L @
  (0.18, 0.29, 0), sleeve_lower_L @ (0.247, 0.039, 0) three.js), so without the re-parent they still fit the rest
  A-pose but will not follow posed arms. `setColor(outfit, 'Outfit_Paint', …)` still reaches moved sleeves (an
  `Assets.instance()` shares each material across the instance). Both ends of every shell are domes centred on the
  joint they hinge about, so elbow/shoulder bends never open a gap (`outfit_sleeves__posed.png`: RIDER pose).
- The helmets cover the scalp. `char_assembly.py --fit` ray-casts every hair vertex against every helmet:
  **0 vertices poke through, all 12 helmet×hair combos.** `hair_long` and `hair_bun` hang below the helmet rims.
- `outfit_poncho` ships a glTF morph target **`seated`**. When the wearer sits, set its influence to 1:
  `mesh.morphTargetInfluences[mesh.morphTargetDictionary.seated] = 1`. The front panel then slopes from the belly
  over the thighs, hangs past the knees, and the back hem lifts off the seat. The morph is tuned for thighs at −1.25..−1.35 rad.

## Rebuild

From `apps/soi-rider`. Run the body first, because every attachment preview imports `char_body.glb`:

```
node blender/run-blender.mjs blender/assets/characters/char_body.py        # char_body (+ previews char_body, char_body__diorama)
node blender/run-blender.mjs blender/assets/characters/char_hair.py        # hair_short, hair_long, hair_bun, hat_cap, acc_mask
node blender/run-blender.mjs blender/assets/characters/char_helmets.py     # helmet_open, helmet_full, helmet_half, helmet_cat
node blender/run-blender.mjs blender/assets/characters/char_outfits.py     # outfit_vest, outfit_hood, outfit_jacket, outfit_poncho
node blender/run-blender.mjs blender/assets/characters/char_assembly.py    # QA renders only (no export); --fit = fit check only
node blender/run-blender.mjs blender/assets/characters/_pelvis_qa.py       # QA only: hip/thigh junction standing + seated
```

Flags: `--no-preview` skips Cycles. `--only=helmet_cat,helmet_full` builds a subset of a family script.

Helpers, all in the characters namespace: `lib/characters_rig.py` (landmarks: joints, head ellipsoid, torso
profile), `lib/characters_geo.py` (loft, shell, tube, band, tuft and the pivot helpers), `lib/characters_attach.py`
(export, then a preview on the real body with zero-offset parenting), `lib/characters_preview.py` (turnaround
renders), `lib/characters_pose.py` (poses) and `lib/characters_sleeves.py` (sleeve shells, facet-exact raised
stripes, the sleeve re-parent rule used by the posed preview).

## QA images

- `blender/previews/<asset>.png`: four-angle turnaround of each asset on the body.
- `char_body__pelvis.png` / `char_body__pelvis_seated.png`: hip/thigh junction close-ups (standing 4 angles; STOOL
  and RIDER seated).
- `outfit_sleeves__posed.png`: hood + jacket with the sleeves re-parented to the arms, RIDER pose.
- `blender/previews/char_assembly.png`: standing rider (helmet_full + outfit_vest), passenger (hair_bun +
  outfit_poncho) and waving pedestrian (hat_cap).
- `char_assembly__seated.png` / `__back.png`: rider and passenger seated on `bike_scooter` (poncho `seated` = 1),
  and a pedestrian on `prop_stool`.
- `char_assembly__diorama.png`: the high 3/4 game camera.
- `char_assembly__helmet_fit.png`: four helmet + hair combos.
- `shots/characters/*.png`: three.js model viewer and engine lookdev screenshots.
