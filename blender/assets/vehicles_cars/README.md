# vehicles_cars: taxi, sedan, commuter van, pickup

Procedural Blender 4.5 scripts for the four four-wheel road vehicles. Each script writes
`public/assets/models/<name>.glb` and Cycles previews to `blender/previews/<name>*.png`.
Contract: `docs/ASSET_SPEC.md`. Style: mockup 03 (chunky, rounded toy diorama).

## Rebuild

```bash
cd apps/soi-rider
node blender/run-blender.mjs blender/assets/vehicles_cars/veh_taxi.py      # + veh_sedan / veh_van / veh_pickup
node blender/run-blender.mjs blender/assets/vehicles_cars/veh_van.py --no-preview   # geometry only, ~10-30 s
node tools/glb-inspect.mjs public/assets/models/veh_van.glb
node tools/shot.mjs --page "sandbox/models.html?models=veh_taxi,veh_sedan,veh_van,veh_pickup&view=diorama" \
  --dir shots/vehicles_cars --steps "until:30000:window.__ready|shot:all_diorama"
```

Each run takes about 10-30 s without previews and 2-3 min with them (Cycles CPU, 3 views).
The budget is enforced by `export_glb(max_tris=3500)`. Set `MAXTRIS=5000` in the environment to bypass it while iterating.

## Assets

| file | tris (≤3500) | size L×W×H, body (m) | with mirrors / sign | notes |
|---|---|---|---|---|
| `veh_taxi` (hero) | 3470 | 4.59 × 1.76 × 1.46 (shell; the `body` mesh is 1.80 wide with door handles and rubbing strips) | W 2.04, H 1.64 with the sign | Corolla-like meter taxi. Own softer toy shell (polish pass): crowned hood into a fat round nose, chunky rounded bumper corners, barrel flanks (tumblehome 0.88 with a t^1.7 curve), rounder plan corners, bubble cabin (top 0.75, bevel 0.16, bigger roof radii). Lamps and corner details are fitted to that shell by `lib/vehicles_cars_taxi.py` (corner casts, see Kit): wrap-around headlamps with a chrome bezel and an amber indicator cap, conformal fog lamps, wrap-around tail lamps with an amber outer end and the brake lens inside, conformal reflectors, a narrower intake; hood/boot shut lines sit on the flat panels. Mirrors, wheels, seams and the grille come from the shared kit. Two-tone: `Paint` lower, `Paint2` upper incl. hood/boot/roof. Roof sign `taxi_sign` (`Sign_Taxi` cream emissive 0.6, "TAXI" modelled on both faces). Red "vacant" light behind the windscreen, white door decals, yellow plates. Preview variants: pink and green/yellow (`_gy`). |
| `veh_sedan` | 3072 | 4.49 × 1.75 × 1.43 | W 2.00 | Vios/City-like private car with a fastback cabin. `Paint` body, `Paint2` roof + pillars. Wide chrome-ringed grille, swept wrap-around lamps, black side skirts, white plates. Variant `_navy` (navy body, black roof). |
| `veh_van` (hero) | 3308 | 5.41 × 1.90 × 2.27 | W 2.47 | HiAce-like Bangkok commuter van ("rot tu"). One-box shell, `Paint` below the belt, `Paint2` above (both white at runtime). Dark window band split into 5 panes per side. Sliding-door outline, rail and handle on the kerb side (LEFT, +X), fuel lid on the right. Big black mirrors on arms, vertical corner tail lamps, high stop lamp, roof ribs, route cards front and rear, yellow public plates. |
| `veh_pickup` | 3416 | 5.32 × 1.84 × 1.80 | W 2.24 | Hilux/D-Max-like double cab. Open bed with a black liner, black over-fenders, running boards, sport bar, chrome mirrors and grille bars, step bumper, white plates. Variant `_black`. |

### Nodes (all four)

```
<name>                  empty at the ground centre
  body                  static shell + details (joined)
    mirror_L / mirror_R pivot at the hinge on the door (rotate about Z to fold); LEFT = +X
    head_lights         Light_Head lenses (emissive 0.8)
    brake_lights        Light_Brake lenses (non-emissive red, runtime boosts it)
    taxi_sign           (taxi only) pivot on the roof
  wheel_FL/FR/RL/RR     pivot at the axle centre, axle along X
```

The models face -Y in Blender, which is +Z in three.js. `glb-inspect` confirms it: `wheel_FL` sits at +X and +Z.

### Materials

Contract names: `Paint`, `Paint2`, `Trim`, `Glass`, `Tire`, `Chrome`, `Light_Head`, `Light_Tail`, `Light_Brake`, `Plate`, `Sign_Taxi`.

Fixed-colour extras that do not use contract names: `Light_Amber` (indicators), `Plate_Text`, `Sign_Text` (taxi sign letters), `Vacant_Light`, `Decal_White` (taxi door decals) and `Sign_Card` (van route cards).

The default `Paint` colours are only for the previews: taxi pink, sedan silver, van white, pickup white. The game recolours `Paint` and `Paint2` by name (see `src/engine/lookdev/lookdev-placements.ts`).

## Kit (`blender/lib/vehicles_cars_*.py`, owned by this group)

| module | what it does |
|---|---|
| `vehicles_cars_mesh.py` | bmesh primitives: rounded box, lathe, profile fillet, prism, arch notch, plan rounding, bevel helpers, ribbon/quad. Also `finish()`: smooth by angle, weighted normals, and `Glass` kept flat with sharp borders. |
| `vehicles_cars_body.py` | `tub()` builds the lower body: profile prism, tumblehome, two bevel passes, rounded plan, two-tone split, dark arches. `greenhouse()` builds the cabin: it bevels first, then cuts, and inset panes split into windows by `pillars`. `Surface` provides BVH ray casts for sticking details onto the body. |
| `vehicles_cars_parts.py` | Parts: wheel (chunky tyre plus domed hubcap), `stick` (rounded part glued to a surface hit), plates, seams (densified so they hug curved panels), door mirror. `patch` is a slab that hugs the surface and is used for wrap-around lamps, bumpers, flares and glass. |
| `vehicles_cars_sedan.py` | Parametric three-box shell plus shared details, driven by a `Spec`. Used by taxi and sedan. |
| `vehicles_cars_van.py` | One-box van shell (single prism with roof, corner and small bevel passes) and `glaze()` for the window band, panes and rear glass. |
| `vehicles_cars_pickup.py` | `carve_bed()` (open load bed), `arch_flare()` (over-fenders), `sport_bar()`. |
| `vehicles_cars_rig.py` | Shared contract materials, modelled text, node hierarchy plus export, and the 3-view preview helper. |
| `vehicles_cars_taxi.py` | Taxi only (asset-polish). `corner_cast()` samples the nose/tail with straight ±Y rays across the flat middle and rays swinging round a vertical axis at each corner, so lamps hug the rounded plan corners (the kit's straight rays graze them and land on the fender). `slab()` is `patch()` without the road-facing bottom wall; `lamp()` adds rounded ends. Taxi `front_details`, `side_details` (no side repeater), `rear_details` and `lights`. |

## Gotchas found while building

- bmesh bevel with `clamp_overlap=False` collapses any band thinner than the bevel offset. Bevel first, then bisect (`greenhouse`).
- Bevel plus taper leaves faces warped by up to about 1 cm. `flatten()` them before inset, otherwise glossy glass shows triangulation creases.
- The van windscreen n-gon is concave at the bevel corners. It is coloured `Trim`, and a clean `patch` of `Glass` is laid on top of it.
- `bmesh.ops.extrude_face_region` keeps the original faces. `carve_bed` deletes the old lid and orients the cavity normals explicitly, because a global recalc flips them.
- `Surface` ray casts raise on a miss. Keep `patch` ranges inside the tapered or bevelled silhouette.
- Straight ±Y casts (`surf.front/rear`) on a rounded plan corner graze the flank and land on the fender: a lamp patch sampled that way spikes back to the wheel arch. Sample corners with `vehicles_cars_taxi.corner_cast()`.
