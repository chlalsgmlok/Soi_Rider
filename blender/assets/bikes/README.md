# bikes group: player bikes and rear gear

Procedural Blender 4.5 scripts that export `public/assets/models/<name>.glb` and write QA renders to
`blender/previews/`. The contract is `docs/ASSET_SPEC.md` (Bikes / Gear), with sizes from `src/core/config/bikes.ts`.
Style target is mockup 03: chunky toy-diorama shapes, flat palette colours, details built as geometry.

Helpers (bikes group only):
- `blender/lib/bikes_kit.py` has the bmesh builders: lathe, loft, superellipse rings, fender arcs, swept tubes, slabs, UV quads, and pivot/parent helpers.
- `blender/lib/bikes_parts.py` has the shared bike parts: materials, wheel, grip, switch pod, lever, mirror, dash, lamp, plate, indicator, peg, shock and rack. It also has `assemble()`, which builds the node contract, and the QA cameras (`qa`, `shot`).
- `blender/lib/bikes_gear.py` has the gear materials, the stacked superellipse loft and the root to mesh assembly.

## Assets

| GLB | tris (budget) | size x·y·z, three.js m (W × H × L) | look |
|---|---|---|---|
| `bike_cub` | 2970 (3000) | 0.76 × 1.19 × 1.86 | Wave-like step-through underbone in taxi pink and cream. Leg shield, front wire basket, handlebar cowl with headlight and speedo, chain case, chrome rack |
| `bike_scooter` (hero) | 2970 (3000) | 0.80 × 1.21 × 1.89 | Click-like automatic scooter in mint over white. Chunky apron with V position lamps, garnish and chrome badge; white floorboard with rubber mat; bar cover with headlight and LCD; oval mirrors; CVT case; black carrier |
| `bike_sport` (POV hero) | 2996 (3000) | 0.86 × 1.24 × 1.99 | CB-like naked bike in red with a white tank stripe and chrome filler cap. Exposed engine, radiator, black tube frame, gold rims, upright chrome bar on round clamps, LCD on a round chrome-ringed headlight, round mirrors on long stems, coral caliper, black tail rack |
| `gear_topbox` | 548 (800) | 0.41 × 0.32 × 0.38 | Puffy hard case in white `Gear_Paint`. Black base and lid seam, lid ribs, red rear reflector, chrome lock |
| `gear_bag` | 474 (800) | 0.45 × 0.48 × 0.43 (incl. strap) | Insulated delivery cube in cyan `Gear_Paint`. Rubber base, zip seam, carry strap, zip pulls, `Gear_Logo` quads on the back and both sides |
| `gear_rack` | 548 (800) | 0.38 × 0.25 × 0.36 | Tapered wire basket on a tubular carrier. All `Gear_Paint` (steel), rubber rim guard (`Trim`), red reflector |

Wheel radius / wheelbase are stored as root extras (`wheel_radius`, `wheelbase`): cub 0.30 / 1.24, scooter 0.265 / 1.28, sport 0.31 / 1.38.
Mirror head centres match `mirrorY` / `mirrorZ` and the outer edges match `mirrorSpan` in `bikes.ts`.

### Node contract (all three bikes, checked from the GLB JSON)

```
bike_<id> (root empty, origin on the ground at the footprint centre, faces +Z in three.js)
├─ frame                 static mesh (everything that does not steer or spin)
├─ steer                 origin on the steering axis at the headstock, tilted by the rake
│   ├─ wheel_F           origin at the axle (spin about local X)
│   ├─ mirror_L / mirror_R   origin at the stem base (+X = model LEFT)
│   ├─ dash              flat quad, material Dash_Screen, UV 0..1
│   ├─ grip_L / grip_R   empties at the grip centres
│   └─ headlight         empty, light origin in front of the lens
├─ wheel_R               origin at the axle
└─ seat_rider, seat_pillion, foot_L, foot_R, gear_mount   empties
```

- **Steering:** `steer` carries a rotation of −rake about X (cub 25°, scooter 26°, sport 25°; also stored as the custom property `rake_deg`). Its local +Y is the steering axis, so the runtime steers with `steer.rotation.y = angle` and keeps the loaded X rotation. Euler order XYZ applies Y inside the tilted frame.
- **Wheel spin:** `wheel_F` cancels the tilt with its own X rotation. Setting `rotation.x` to a spin angle is still visually correct because the wheel is a body of revolution about X.
- **Dash UVs:** u runs left to right and v runs bottom to top as the rider sees it, so a `CanvasTexture` on `Dash_Screen` needs `flipY = false` (the glTF convention). The same applies to `Gear_Logo`.
- **Gear:** each gear GLB is `gear_<id>` (root empty, origin at the mount point, bottom centre) with one mesh child (`box`, `bag` or `rack`), matching the runtime placeholders. Mount it on `gear_mount` with zero offset.
- **Materials:** contract names are `Paint`, `Paint2`, `Trim`, `Seat`, `Chrome`, `Tire`, `Light_Head`, `Light_Tail`, `Light_Brake`, `Glass`, `Dash_Screen`, `Plate`, `Gear_Paint` and `Gear_Logo`. Fixed-colour extras use non-contract names: `Rim`, `Engine`, `Metal`, `Indicator`, `Button`, `Ink`.

## Rebuild

From `apps/soi-rider`:

```
node blender/run-blender.mjs blender/assets/bikes/bike_cub.py       # + previews bike_cub{,_rear,_side,_pov}.png
node blender/run-blender.mjs blender/assets/bikes/bike_scooter.py
node blender/run-blender.mjs blender/assets/bikes/bike_sport.py
node blender/run-blender.mjs blender/assets/bikes/gear_topbox.py
node blender/run-blender.mjs blender/assets/bikes/gear_bag.py
node blender/run-blender.mjs blender/assets/bikes/gear_rack.py
node blender/run-blender.mjs blender/assets/bikes/gear_seats.py   # gear_cushion, gear_backrest, gear_throne (mount on seat_pillion)
node blender/run-blender.mjs blender/assets/bikes/preview_gear.py   # QA only: bikes with gear on gear_mount
```

Flags: `--no-preview` builds geometry only. `--fast` renders cheaper previews. `--only=main,rear,side,pov` picks which bike QA renders to make.
Export fails if a budget is exceeded (`export_glb(max_tris=…)`). Each bike script prints a per-part `[tris]` table to its log.

QA renders in `blender/previews/`:
- `bike_*.png` (front 3/4), `bike_*_rear.png` (diorama-like rear high), `bike_*_side.png`, `bike_*_pov.png` (FOV 72 from behind the bars)
- `gear_*.png`
- `bike_*_gear.png`, `bike_*_gear_front.png`, `bikes_gear_lineup.png`

Game-renderer screenshots are in `shots/bikes/`: `bikes_{diorama,side,front}.png`, `gear_diorama.png`, `gear_front.png`, `engine_diorama.png`.
