# vehicles_thai — tuk-tuk, city bus, songthaew, BTS car

Procedural Blender 4.5 scripts for the Thai street vehicles of SOI RIDER (style: mockup 03 toy diorama).
Contract: `docs/ASSET_SPEC.md` (Vehicles). All models face **-Y in Blender** (= +Z forward in three.js); the
model's LEFT is **+X**. Origin = ground (z=0) at the footprint centre; static nodes sit exactly at the origin.

| asset | script | tris (budget) | size L x W x H (m) | width incl. mirrors |
|---|---|---|---|---|
| `veh_tuktuk` (hero) | `veh_tuktuk.py` | 3490 (3500) | 3.00 x 1.41 x 1.90 | 1.59 (traffic `mirrorSpan` 1.6) |
| `veh_bus` | `veh_bus.py` | 4634 (5000) | 11.50 x 2.55 x 3.21 | 2.90 (`mirrorSpan` 2.9) |
| `veh_songthaew` | `veh_songthaew.py` | 3398 (3500) | 5.00 x 1.80 x 2.19 | 2.05 (`mirrorSpan` 2.05) |
| `bts_train` | `bts_train.py` | 3174 (3500) | 22.0 x 3.00 x 3.76 (contract 22 x 3.0; shell 21.72 x 2.94, anticlimbers/gangway/panes/gutters stand proud inside it) | — |

## Nodes
- **veh_tuktuk**: `body`, `wheel_F`, `wheel_RL`, `wheel_RR` (origin = axle centre), `mirror_L`, `mirror_R`
  (origin = hinge on the windscreen post; rotate about Z to fold), `brake_lights` (`Light_Brake`), `head_lights` (`Light_Head`).
- **veh_bus**: `body`, `wheel_FL/FR/RL/RR`, `mirror_L/R` (hinge at the front corner pillar), `brake_lights`, `head_lights`,
  `route_board` (flat quad above the windscreen, `Sign_Face`, UV 0..1, u = viewer's right, v = up). Doors on +X (kerb side).
- **veh_songthaew**: `body`, `wheel_FL/FR/RL/RR`, `mirror_L/R` (hinge on the door top), `brake_lights`, `head_lights`,
  `route_board` (extra: small roof-front sign quad, `Sign_Face`, UV 0..1).
- **bts_train**: `body`, `head_lights`, `route_board` (destination display above the windscreen, `Sign_Face`, UV 0..1).
  Lead car: driver's nose at -Y, gangway at +Y. Origin at the running surface (z=0) so it sits on the `bts_deck` top.
  Chain cars every 22 m along Y and rotate the last car 180 deg about Z so the train has a nose at both ends.

## Materials
Contract names: `Paint`, `Paint2`, `Trim`, `Glass`, `Tire`, `Chrome`, `Seat`, `Light_Head`, `Light_Tail`, `Light_Brake`,
`Plate`, `Sign_Face`, plus `Canopy` (tuk-tuk). Group-local fixed colours (not recoloured by the runtime):
`Light_Deco` (tuk-tuk candy lamps), `Plate_Green` ("THAILAND" plate), `Mirror_Glass`, `Light_Indicator` (bus),
`Stripe` (songthaew cream side stripe), `Livery_Blue`, `Roof_Skin`, `Roof_Unit` (BTS).
- tuk-tuk: `Paint` blue body, `Paint2` canopy rim stripe (all round) + scalloped valance (one scallop per cushion) + pinstripes,
  `Canopy` dark quilted roof (6 padded cushions: seams pinched 3 cm in / 6 cm down and creased, flat-topped crowns,
  rounded nose/tail), `Seat` red benches. Polish pass 2026-10: canopy rebuilt (was a flat slab); paid for by 6-seg
  mirror pods / deco lamps, 8-seg brake bezels and simpler seat-back fillets.
- bus: `Paint` red lower body / stripes / gutters, `Paint2` cream upper body, roof hatches, roof ribs, waist stripe.
- songthaew: `Paint` red body, `Paint2` rear-cabin roof (config sets it equal to `Paint`), `Seat` wooden benches.
- BTS: `Paint` white body, `Paint2` green stripe + doors, `Livery_Blue` lower band.

## Rebuild
```bash
cd apps/soi-rider
node blender/run-blender.mjs blender/assets/vehicles_thai/veh_tuktuk.py     # + veh_bus.py, veh_songthaew.py, bts_train.py
node blender/run-blender.mjs blender/assets/vehicles_thai/veh_bus.py --no-preview   # geometry only, no Cycles render
node tools/glb-inspect.mjs public/assets/models/veh_tuktuk.glb
node tools/shot.mjs --page "sandbox/models.html?models=veh_tuktuk,veh_songthaew,veh_bus&view=diorama" --dir shots/vehicles_thai --steps "until:30000:window.__ready|shot:group"
```
Outputs: `public/assets/models/<name>.glb`, previews `blender/previews/<name>.png` (+ `_rear`, bus `_kerb`).
Group helpers live in `blender/lib/vehicles_thai_kit.py` (bmesh lofts/prisms/lathes, `toy_wheel`, `ring_lamp`,
`mirror_pod`, `fit_y` to hit the contract length, `bake_location` so static nodes sit at the origin).

## Notes
- Each script models at a convenient scale, then `fit_y` scales along Y to the exact contract length (wheels are moved,
  never squashed); triangle budgets are enforced by `export_glb(max_tris=...)`.
- Mirror spans/heights follow `src/core/config/traffic.ts` (`mirrorSpan`, `mirrorY`, `mirrorZ`) because the clearance
  sensor uses those numbers.
- Tuk-tuk windscreen uses a translucent `Glass` (alpha 0.4); the other vehicles use opaque dark glass.
