# props_street — street-food corner, plants, trees, clutter

Toy-diorama street props for SOI RIDER (style: `docs/reference/mockup-03-diorama.png`). Every prop is ONE joined
mesh node named after the file (no runtime sub-nodes are required by `docs/ASSET_SPEC.md` for this group), origin on
the ground at the footprint centre (trees: at the trunk base), fronts facing **-Y in Blender** (= +Z in three.js).
Budgets: <= 900 tris, trees <= 1500 (enforced by `export_glb(max_tris=...)`).

## Assets

Sizes are three.js axes (x × y-up × z), from `node tools/glb-inspect.mjs`.

| GLB | tris | size (m) | materials | notes |
|---|---|---|---|---|
| `prop_food_cart` (HERO) | 890 | 1.82 × 2.89 × 1.74 (x −0.99..0.83, z −1.01..0.74) | Steel, Paint, Accent_Cream, Glass_Case, Food_Chicken, Wood, Tire, **Canvas**, Canvas_Stripe, Lamp_Glow | chicken-rice cart: rounded steel cabinet, red `Paint` panels + cream stripe + menu sticker, glass case with 2 plump smooth-shaded roast chickens, red sign board with glyph bars, stock pot + chopping block, big red-hubbed 14-seg wheels (+X end, hub only on the visible outer face), legs + push handle (-X end), pillowy 8-panel umbrella (r 0.85, 4 radial rings) on a shaft rising behind the glass case and leaning 8° to the customer side so the canopy stays over the cart footprint; the canopy rides 0.2 m above the sign board so a length of shaft shows from the diorama camera; emissive bulb under it. Decals (panels, menu, sign face, glyphs) are single outward quads |
| `prop_stool` | 414 | 0.36 × 0.44 × 0.36 | **Plastic** | Thai plastic stool, flared skirt with 4 arched cut-outs, rolled seat rim |
| `prop_table` | 641 | 0.90 × 0.86 × 0.62 | Steel, Trim, Accent_Red/Cream/Green | steel folding table, condiment caddy (3 jars), tissue box |
| `prop_umbrella` | 780 | 2.78 × 2.80 × 2.78 | **Canvas**, Canvas_Stripe, Accent_Cream, Steel, Tire, Concrete | market umbrella, 8 pillowy panels (5 radial rings, each panel inflated along the dome normal) + scalloped rim and valance, ribs, tyre-and-concrete base; fabric keeps smooth normals |
| `prop_pot_plant` | 530 | 1.08 × 0.71 × 1.13 | Pot, Soil, **Leaf**, **Leaf2** | arching two-tone leaf tuft in a terracotta pot |
| `prop_banana` | 579 | 2.53 × 2.51 × 2.07 | Pot, Soil, Stem, **Leaf**, **Leaf2**, Accent_Yellow, Banana_Heart | potted banana, ragged paddle leaves, sucker, bunch + heart |
| `prop_bougainvillea` | 870 | 1.29 × 1.42 × 1.22 | Pot, Soil, Trunk, **Leaf**, **Flower** | rain-tree style: one soft noise-displaced `Leaf` foliage mass studded with eight smaller smooth magenta `Flower` sprays (low lumpy domes ray-cast onto the real mass surface, clumped on the street side and the top) and three sprays tumbling over the front rim; one colour per mass, smooth normals (no faceted gem balls) |
| `prop_palm` | 1027 | 5.23 × 7.46 × 5.45 | Trunk, Trunk2, **Leaf**, **Leaf2**, Coconut | coconut palm, leaning ringed trunk, 12 serrated two-tone fronds, coconut cluster. Origin = trunk base (crown leans to +X) |
| `prop_raintree` | 1428 | 10.38 × 9.06 × 10.21 | Trunk, **Leaf**, **Leaf2** | stout flared trunk, 3 buttress roots, 4 limbs, dark flat-bottomed dome with light clumps on top and around the rim |
| `prop_crates` | 864 | 1.11 × 0.61 × 0.47 | **Plastic**, Crate_Hole, Crate_Yellow, Bottle, Bottle_Cap, Coconut | 2 stacked soda crates (Plastic, top one full of bottles) + yellow crate of green coconuts |
| `prop_ice_box` | 448 | 0.80 × 0.61 × 0.50 | **Plastic**, Accent_Cream, Accent_Red, Steel, Trim | vendor cooler: cream lid with raised panel, latch, side grips, label, drain plug, ice scoop |
| `prop_ac_unit` | 816 | 0.95 × 0.96 × 0.39 | AC_Body, Trim, Grille, Badge, Pipe | outdoor condenser on wall brackets: fan well + bezel + blades + grille bars, valve cover, side vents, insulated pipes climbing the wall. Back (+Y Blender = -Z three.js) goes against the wall |
| `prop_bin` | 556 | 0.64 × 0.98 × 0.83 | **Plastic**, Bin_Lid, Trim, Tire, Accent_Cream | wheelie bin: tapered green body, yellow domed lid + grip, back wheels + handle, recycling sticker |
| `prop_cone` | 344 | 0.42 × 0.71 × 0.42 | **Plastic**, Stripe_White, Trim | fat cone with 2 raised reflective bands on a dark rounded base |

**Bold** = contract names from ASSET_SPEC (`Plastic`, `Canvas` are runtime-recolourable). Other names are fixed
accent colours and do not reuse contract names. `Steel` is a non-metallic cool silver (`#C3CCD6`), because metallic
materials go muddy in three.js without an environment map.

## Scripts

| script | builds |
|---|---|
| `food_cart.py` | prop_food_cart |
| `furniture.py` | prop_stool, prop_table, prop_umbrella |
| `plants.py` | prop_pot_plant, prop_banana, prop_bougainvillea |
| `trees.py` | prop_palm, prop_raintree |
| `clutter.py` | prop_crates, prop_ice_box, prop_ac_unit, prop_bin, prop_cone |
| `_corner_preview.py` | renders `blender/previews/props_street_corner.png` from the exported GLBs (exports nothing) |

Helpers (group-owned): `blender/lib/props_street_kit.py` (lathe / tube / leaf / lumpy / canopy / finish /
run_assets) and `blender/lib/props_street_parts.py` (rbox = one-segment chamfer box that shades round through
weighted normals, tyre, ball, ring).

## Rebuild

```bash
cd apps/soi-rider
node blender/run-blender.mjs blender/assets/props_street/food_cart.py            # + Cycles preview
node blender/run-blender.mjs blender/assets/props_street/furniture.py --no-preview --only prop_stool
node blender/run-blender.mjs blender/assets/props_street/plants.py
node blender/run-blender.mjs blender/assets/props_street/trees.py
node blender/run-blender.mjs blender/assets/props_street/clutter.py
node blender/run-blender.mjs blender/assets/props_street/_corner_preview.py      # after the GLBs exist
node tools/glb-inspect.mjs public/assets/models/prop_food_cart.glb
node tools/shot.mjs --page "sandbox/models.html?models=prop_food_cart,prop_umbrella&view=diorama" \
  --dir shots/props_street --steps "until:30000:window.__ready|shot:check"
```

Flags: `--no-preview` skips the Cycles render, `--only a,b` limits a multi-asset script, `--nobudget` disables the
triangle check while experimenting.

Outputs: `public/assets/models/prop_*.glb`, `blender/previews/prop_*.png`, `blender/previews/props_street_corner.png`;
in-engine checks in `shots/props_street/final_*.png`.
