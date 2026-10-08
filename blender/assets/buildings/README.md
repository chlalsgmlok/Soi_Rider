# buildings — SOI RIDER architecture (Blender 4.5 → GLB)

Contract: `docs/ASSET_SPEC.md` (Buildings). Style: mockup 03, a chunky toy diorama with rounded bevels, flat saturated
colours, and details modelled as geometry. Blender is Z-up in metres. Every facade faces **−Y** (the street side),
and the origin sits at the **bottom-centre of the facade line** (y = 0). Street furniture such as awnings, canopies,
stairs and signs sticks out into −Y. Each GLB has a root empty named after the asset. Under it is one joined `body`
mesh plus the runtime nodes listed below.

## Assets

Size is the GLB bounding box in metres: W (x) × D (y, incl. front protrusions) × H (z). Tris are the exported count.

| asset | tris / budget | W × D × H | runtime nodes | contract materials |
|---|---|---|---|---|
| `bld_shophouse_2f` | 3014 / 3500 | 4.00 × 11.72 × 8.60 (parapet 7.5) | `body`, `signboard` | Wall, Wall2, Trim, Window, Shutter, Awning_A/B, Interior_Light, Lamp_Glow, Sign_Face, Glass, Chrome, Leaf, Flower |
| `bld_shophouse_3f` | 3412 / 3500 | 4.22 × 11.72 × 12.31 (parapet 10.5) | `body`, `signboard` | same |
| `bld_shophouse_4f` | 3494 / 3500 | 4.22 × 11.72 × 15.52 (parapet 13.5) | `body`, `signboard` | same |
| `bld_minimart` | 2208 / 3500 | 8.74 × 12.17 × 5.40 (parapet 4.5) | `body`, `signboard` | Wall, Wall2, Trim, Paint, Paint2, Interior_Light, Lamp_Glow, Sign_Face, Chrome |
| `bld_mall` | 3054 / 3500 | 32.0 × 32.9 × 18.75 (crown 18.0) | `body`, `screen` | Wall, Wall2, Trim, Window, Glass, Lamp_Glow, Interior_Light, Sign_Face, Leaf, Flower |
| `bld_condo` | 2492 / 2500 | 15.94 × 18.37 × 61.4 (crown 58.6, mast to 61.4) | `body` | Wall, Wall2, Trim, Window, Lamp_Glow, Leaf |
| `bld_office` | 2436 / 2500 | 20.04 × 21.22 × 80.2 | `body` | Wall, Wall2, Trim, Window, Lamp_Glow, Chrome |
| `bld_temple` | 3406 / 3500 | 18.0 × 30.44 × 14.03 | `body` | Wall, Wall2, Trim, Leaf, Flower (+ fixed Bld_RoofRed/Green, Bld_Gold, Bld_TempleDoor) |
| `bts_pillar` | 820 / 3500 | 7.96 × 4.04 × 9.50 | `body` | (fixed Bld_* concrete / hazard / curb) |
| `bts_deck` | 1414 / 3500 | 9.53 × 40.0 × z 9.50..11.00 | `body` | Paint (accent band, recolour per line) |
| `bts_station` | 3404 / 3500 | 19.7 × 61.84 × 16.92 | `body`, `signboard` | Wall, Wall2, Trim, Window, Paint, Lamp_Glow, Sign_Face |

`signboard` and `screen` are flat quads with `Sign_Face` and UVs 0..1 (u runs toward +X, which is the viewer's right
when facing the facade; v runs toward +Z). They face −Y, and the runtime draws its canvas text on them.
Placements:
- **shophouse 3f**: on the wall above the shutter, x ±1.76, z 3.28..3.88.
- **shophouse 2f / 4f**: on the balcony / cage fascia, because a wall sign would be hidden under the slab from the diorama camera.
- **minimart**: on the canopy fascia.
- **mall** `screen`: 10 × 5.5 m centred at x = +6, z = 12.5.
- **station**: on the −Y end beam (8 × 0.76 m at z 15.3).

### Shophouse module rules (tiling)
- Each module is 4.0 m wide (x −2..2) and 10 m deep. The floor lines are the same on every module: ground floor 4.0, upper floors 3.0, parapet 0.5. String courses, awnings (z 3.08), signs and half-pilasters therefore line up across mixed rows. Two neighbours' half-pilasters form one 0.4 m column.
- The 3f and 4f carry party-wall dressing (rear downpipes, vents, and a painted ad on the 4f's +X wall). It only appears where they rise above a lower neighbour. Nothing sits below z 7.25, so it hides inside a neighbour that is the same height or taller. This makes their bounding boxes 4.22 m wide, but **the module pitch stays 4.0 m**.
- Recolour by material name: `Wall`, `Wall2`, `Trim`, `Awning_A` / `Awning_B`, `Shutter`. `_row_test.py` checks a 6-module mixed row with recolours.
- The ground floor has a roller shutter pulled down to z 1.8, a warm `Interior_Light` back wall with shelves and a counter, two bare `Lamp_Glow` bulbs hanging under the scalloped striped awning, and a lintel.

### BTS set (assembles exactly; shared constants in `lib/buildings_bts.py`)
- The line runs along Y. The pillar crossbeam top equals the deck soffit at z 9.5. The deck slab is at 10.6, rail tops at 10.88, tracks at x = ±2.0, parapet top at 11.0.
- `bts_deck` is a 40 m segment centred on its origin, with flat ends so segments tile. `bts_pillar` goes at the joints (every 40 m); its bearings sit under the deck's flat soffit.
- `bts_station` straddles the continuous deck: the deck passes through the |x| ≤ 4.6 opening. The station brings its own two median T-frames at y = ±18. **World generation should not place `bts_pillar` within |y| < 30 of a station centre.** The station has no street stairs; they would land in traffic lanes or on sidewalks whose width the asset cannot know.

## Rebuild

```
node blender/run-blender.mjs blender/assets/buildings/<asset>.py            # GLB + Cycles preview
node blender/run-blender.mjs blender/assets/buildings/<asset>.py --no-preview
node blender/run-blender.mjs blender/assets/buildings/_row_test.py          # QA: 6 mixed shophouses -> previews/bld_row_test.png + bld_row_street.png
node blender/run-blender.mjs blender/assets/buildings/_bts_test.py          # QA: pillars + 5 decks + station -> previews/bts_line_test.png + bts_line_street.png
node tools/glb-inspect.mjs public/assets/models/<asset>.glb
node tools/shot.mjs --page "sandbox/models.html?models=bld_temple,bld_mall&view=diorama" --dir shots/buildings --steps "until:30000:window.__ready|shot:temple_mall"
```
The `_row_test` / `_bts_test` QA scripts import the exported GLBs, so run them after the asset scripts.

## Kit (blender/lib, group-owned helpers)
| file | purpose |
|---|---|
| `buildings_kit.py` | materials(), Parts collector -> one `body`, `bx`/`rbx` (boxes with hidden faces removed), `prism`, `quad_uv`/`quad_x`, `frame_ring`, `rod`, `preview_framed` |
| `buildings_parts.py` | awning (striped + scalloped), roller shutter, shop interior, sign board, window (frame/mullions/hood/shutters/grille), AC unit, water tank, plants, roof shed, laundry line |
| `buildings_shophouse.py` | shophouse shell (masses, pilasters, bands, cornice, parapets, shop front, awning bulbs), side dressing, `signboard` |
| `buildings_tower.py` | rounded-rect plans, chamfered floor bands, shafts (condo / office / mall) |
| `buildings_temple.py` | Thai roof vocabulary: gable tiers, slope slabs, green eave borders, naa-ban gable faces, bargeboards with bai-raka teeth, chofa, hang-hong |
| `buildings_bts.py`, `buildings_bts_deck.py` | BTS constants, column / hammerhead / median planter, deck girder profile, parapets, slab track |

## Notes
- `Window` is the night-emissive contract material. In `sandbox/models.html` (no environment map) glass reads dark navy, while the engine's look-dev scene with its sky environment lights it properly.
- Gold (`Bld_Gold`) uses metallic 0.55 so it still reads warm without an environment map.
- Tight budgets: the shophouse 4f is at 3494 of 3500 and the condo at 2492 of 2500. Any added detail needs a matching cut. Use `Parts.report()`, which prints the cost of each part to the log.
