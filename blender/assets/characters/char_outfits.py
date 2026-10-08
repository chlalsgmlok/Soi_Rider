"""Torso outfits for char_body: outfit_vest (orange win vest, number patch, reflective stripes),
outfit_hood (hood down + drawstrings), outfit_jacket (track jacket: collar, zip, rib cuffs), outfit_poncho
(rain poncho over torso + upper legs, shape key `seated` drapes it over the thighs).

Origin = `torso` joint (waist, z=1.00 in body space) -> parent to `torso` with zero offset.
outfit_hood / outfit_jacket also carry four sleeve nodes (children of the root): sleeve_upper_L/R (origin =
shoulder) and sleeve_lower_L/R (origin = elbow). The runtime re-parents each onto arm_<side> / forearm_<side>
with zero offset so the sleeves follow the arms (blender/lib/characters_sleeves.py, README "Attachments").
Run: node blender/run-blender.mjs blender/assets/characters/char_outfits.py [--no-preview] [--only=outfit_vest]
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Vector
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import join, cyl
from lib import characters_rig as R
from lib.characters_geo import loft, ellipsoid, tube, band, tuft, text_mesh, at_zero, transform, frame_matrix
from lib.characters_attach import run_family, wants, import_body, import_glb, attach
from lib.characters_sleeves import shell as sleeve_shell, limb_point, facet_point, strip, attach_to_root
from lib.characters_sleeves import reparent_sleeves
from lib.characters_preview import render
from lib.characters_pose import RIDER, apply_pose
from lib.bootstrap import clear_scene
from mathutils import Matrix

ctx = start()
SEGS = 12


def prof(z, off, extra_y=0.0):
    rx, ry, cy = R.torso_at(z)
    return (z, rx + off, ry + off + extra_y, cy)


def surf(z, theta_deg, off):
    """Point on the torso surface + off at height z, angle theta (0 = front, + towards model LEFT)."""
    rx, ry, cy = R.torso_at(z)
    t = math.radians(theta_deg)
    return Vector(((rx + off) * math.sin(t), cy - (ry + off) * math.cos(t), z))


def surf_n(z, theta_deg):
    t = math.radians(theta_deg)
    return Vector((math.sin(t), -math.cos(t), 0.15)).normalized()


def arc_band(name, z, th0, th1, n, off, width, thick, m):
    ths = [th0 + (th1 - th0) * i / (n - 1) for i in range(n)]
    return band(name, [surf(z, t, off) for t in ths], [surf_n(z, t) for t in ths], width, thick, m)


def disc(name, center, normal, radius, depth, m, verts=8):
    d = cyl(name, radius, depth, (0, 0, 0), m, verts=verts, bevel=0)
    return transform(d, Matrix.Translation(center) @ frame_matrix(normal, (0, 0, 1)).to_4x4())


# ---------------------------------------------------------------- outfit_vest
def outfit_vest():
    paint = mat('Outfit_Paint', 'cloth_orange', roughness=0.7)
    trim = mat('Outfit_Trim', 'chrome', roughness=0.3, metallic=0.25)
    patch = mat('Vest_Patch', 'plate_yellow', roughness=0.6)
    ink = mat('Vest_Number', 'ink', roughness=0.5)
    o = 0.017
    zs = [(0.925, 0.03), (0.962, 0.016), (1.000, o), (1.048, o), (1.050, o + 0.003), (1.076, o + 0.003), (1.078, o),
          (1.118, o), (1.120, o + 0.003), (1.146, o + 0.003), (1.148, o), (1.200, o), (1.250, o), (1.292, o),
          (1.336, o), (1.366, o)]
    rings = [prof(z, off) for z, off in zs]
    rings[0] = (0.925, 0.188, 0.142, 0.0)
    rings[1] = (0.962, 0.194, 0.148, 0.0)
    bands = [1 if (zs[i][1] > o + 0.001 and zs[i + 1][1] > o + 0.001) else 0 for i in range(len(zs) - 1)]
    z_v, z_top = 1.17, zs[-1][0]

    def vneck(p, ri, k):
        th = 2 * math.pi * k / SEGS
        w = max(0.0, math.cos(th)) ** 2.2
        if p.z <= z_v or w == 0:
            return p
        t = (p.z - z_v) / (z_top - z_v)
        nz = p.z - w * (t ** 0.7) * (p.z - z_v) * 0.96
        off = o + 0.002
        return surf(nz, math.degrees(th), off) if w > 0.3 else p.lerp(surf(nz, math.degrees(th), off), w / 0.3)
    body = loft('vest', rings, SEGS, [paint, trim], band_mats=bands, cap_bottom=False, cap_top=False, vfn=vneck)
    top = [vneck(Vector((0, 0, 0)) + Vector(p), len(rings) - 1, k)
           for k, p in enumerate(_ring_pts(rings[-1]))]
    nrm = [Vector((p.x, p.y, 0.6)).normalized() for p in top]
    parts = [body, band('binding', top, nrm, 0.018, 0.006, paint, closed=True)]
    parts.append(arc_band('patch', 1.195, 148, 212, 7, o + 0.001, 0.125, 0.005, patch))
    num = text_mesh('num', '23', 0.085, 0.003, (0, 0, 0), (math.radians(90), 0, math.radians(180)), ink, bold=0.004)
    for v in num.data.vertices:
        p = surf(1.195 + v.co.z, 180 + math.degrees(math.asin(max(-1, min(1, -v.co.x / 0.2)))), o + 0.008)
        v.co = Vector((p.x, p.y + v.co.y, p.z))
    num.data.update()
    parts.append(num)
    parts.append(arc_band('tag', 1.20, 24, 40, 3, o + 0.001, 0.045, 0.004, patch))
    return at_zero(join(parts, 'outfit_vest'), R.TORSO)


def _ring_pts(r):
    z, rx, ry, cy = r[0], r[1], r[2], r[3]
    return [Vector((rx * math.sin(2 * math.pi * k / SEGS), cy - ry * math.cos(2 * math.pi * k / SEGS), z))
            for k in range(SEGS)]


# ---------------------------------------------------------------- sleeves (shared by hood + jacket)
def ring_at(rings, z):
    """(rx, ry, cy) of a loft ring list (z ascending) at height z, linearly interpolated like the loft faces."""
    for a, b in zip(rings, rings[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(a[i] + (b[i] - a[i]) * t for i in (1, 2, 3))
    r = rings[0] if z < rings[0][0] else rings[-1]
    return r[1], r[2], r[3]


def on_shell(rings, z, theta, lift=0.0, segs=SEGS):
    """Point + normal ON the faceted outfit shell (loft `rings`, `segs`) at height z, loft angle theta (deg)."""
    rx, ry, cy = ring_at(rings, z)
    q, n2 = facet_point(rx, ry, theta, segs, lift)
    return Vector((q.x, q.y + cy, z)), Vector((n2.x, n2.y, 0.0))


def build_sleeves(root, spec, mats, stripe_mat=None):
    """Four sleeve shells (separate nodes) under the outfit root. spec: upper/lower ring lists (limb space, top ->
    bottom, domes at both ends centred on the joints) + band material indices; optional twin stripes."""
    for side, sfx in ((1, 'L'), (-1, 'R')):
        for seg, joint in (('upper', R.shoulder(side)), ('lower', R.elbow(side))):
            rings = spec[seg]
            parts = [sleeve_shell('shell', rings, mats, spec.get(seg + '_bands'), joint, side)]
            if stripe_mat is not None:
                lo, hi = spec[seg + '_stripe']
                for a in (8.5, -8.5):
                    hits = [limb_point(joint, side, rings[i], side * (90 - a), lift=0.0008) for i in range(lo, hi + 1)]
                    parts.append(strip('st', [h[0] for h in hits], [h[1] for h in hits], 0.010, 0.0042, stripe_mat))
            obj = join(parts, f'sleeve_{seg}_{sfx}')
            attach_to_root(obj, root)
    return root


# ---------------------------------------------------------------- outfit_hood
HOOD_SLEEVE = {
    # puffy fleece: shoulder dome r 0.080 around the arm's ball (r 0.062), slight bell, gathered rib cuff
    'upper': [(0.080, 0, 0), (0.0566, 0.0566, 0.055), (0.0, 0.080, 0.078), (-0.21, 0.073, 0.071),
              (-0.258, 0.066, 0.064), (-0.303, 0, 0)],
    'lower': [(0.072, 0, 0), (0.051, 0.051, 0.050), (0.0, 0.072, 0.070), (-0.172, 0.076, 0.074),
              (-0.188, 0.065, 0.063), (-0.240, 0.065, 0.063), (-0.252, 0, 0)],
}


def outfit_hood():
    paint = mat('Outfit_Paint', 'cloth_green', roughness=0.85)
    trim = mat('Outfit_Trim', 'cloth_white', roughness=0.6)
    o = 0.024
    # rib waistband clears the pelvis (rx 0.19 at z 0.88) by 1 cm, then the fleece blouses out over it
    rings = [(0.880, 0.204, 0.138, 0.004), (0.904, 0.205, 0.141, 0.004), (0.936, 0.214, 0.152, 0.002),
             prof(1.0, o + 0.012), prof(1.07, o + 0.006), prof(1.24, o), prof(1.292, o), prof(1.336, o),
             (1.368, 0.114, 0.098, 0.004), (1.388, 0.086, 0.078, 0.006)]
    parts = [loft('hoodie', rings, SEGS, [paint], cap_bottom=False, cap_top=True)]
    # kangaroo pocket: a 1.2 cm proud pouch whose back face is buried 5 mm inside the fleece
    pk = [on_shell(rings, 1.05, th, -0.005) for th in (-50, -25, 0, 25, 50)]
    parts.append(band('pocket', [p for p, _ in pk], [n for _, n in pk], 0.12, 0.017, paint))
    u = [surf(1.372, th, 0.03) for th in (52, 95, 137, 180, 223, 265, 308)]
    for p in u:
        p.z += 0.012 * (1 - abs(math.cos(math.atan2(p.x, -p.y))))
    parts.append(tube('hoodroll', u, 0.03, paint, segs=6))
    # hood folded down the back: teardrop (round top under the neck roll, soft point at the shoulder blades)
    parts.append(tuft('hoodbag', (0, 0.150, 1.372), (0, 0.172, 1.150), 0.25, 0.085, paint, (0, 1, 0), segs=8,
                      profile=(0.92, 1.0, 0.82, 0.5)))
    for s in (1, -1):
        a = surf(1.366, s * 34, 0.03)
        pts = [a, a + Vector((s * 0.003, -0.013, -0.075)), a + Vector((s * 0.006, -0.008, -0.155))]
        parts.append(tube(f'string{s}', pts, 0.0075, trim, segs=4))
        parts.append(ellipsoid(f'aglet{s}', pts[-1] + Vector((0, 0, -0.014)), (0.011, 0.011, 0.020), trim, segs=6,
                               rings=2))
    root = at_zero(join(parts, 'outfit_hood'), R.TORSO)
    return build_sleeves(root, HOOD_SLEEVE, [paint])


# ---------------------------------------------------------------- outfit_jacket (track jacket)
JACKET_SLEEVE = {
    'upper': [(0.075, 0, 0), (0.053, 0.053, 0.051), (0.0, 0.075, 0.073), (-0.21, 0.068, 0.066),
              (-0.258, 0.061, 0.059), (-0.300, 0, 0)],
    # white rib cuff (Outfit_Trim) stands 7 mm proud and swallows the shirt cuff (r 0.057)
    'lower': [(0.067, 0, 0), (0.047, 0.047, 0.046), (0.0, 0.067, 0.065), (-0.170, 0.062, 0.060),
              (-0.180, 0.069, 0.067), (-0.238, 0.069, 0.067), (-0.250, 0.052, 0.050), (-0.256, 0, 0)],
    'lower_bands': [0, 0, 0, 1, 1, 1, 1],
    'upper_stripe': (1, 4), 'lower_stripe': (2, 3),     # ring index range the twin stripes run over
}


def outfit_jacket():
    paint = mat('Outfit_Paint', 'cloth_red', roughness=0.45)
    trim = mat('Outfit_Trim', 'cloth_white', roughness=0.5)
    o = 0.021
    # rib hem (trim) clears the pelvis (rx 0.188 at z 0.90) by 1.1 cm; a little blouson step above it
    rings = [(0.898, 0.199, 0.139, 0.004), (0.930, 0.201, 0.141, 0.003), (0.934, 0.208, 0.150, 0.002),
             (0.962, 0.208, 0.152, 0.0), prof(1.0, o + 0.003)] + [prof(z, o) for z in (1.07, 1.24, 1.292, 1.336,
                                                                                       1.365)]
    parts = [loft('jacket', rings, SEGS, [paint, trim], band_mats=[1, 1] + [0] * 7, cap_bottom=False,
                  cap_top=False)]
    parts.append(loft('collar', [(1.350, 0.118, 0.100, 0.004), (1.385, 0.096, 0.086, 0.004), (1.425, 0.094, 0.084, 0.0),
                                 (1.434, 0.094, 0.084, 0.0), (1.442, 0.086, 0.076, 0.0)], SEGS, [paint, trim],
                      band_mats=[0, 0, 1, 1], cap_bottom=False, cap_top=False))
    zp = [on_shell(rings, z, 0, 0.0008) for z in (0.915, 1.0, 1.10, 1.24, 1.336)]
    zip_pts = [p for p, _ in zp] + [Vector((0, -0.090, 1.385)), Vector((0, -0.093, 1.428))]
    parts.append(strip('zip', zip_pts, [n for _, n in zp] + [Vector((0, -1, 0.1))] * 2, 0.012, 0.004, trim))
    pull = zip_pts[-1] + Vector((0, -0.009, -0.03))
    parts.append(band('pull', [pull + Vector((0, 0, 0.013)), pull - Vector((0, 0, 0.013))], [Vector((0, -1, 0))] * 2,
                      0.015, 0.005, trim))
    for s in (1, -1):
        pw = [on_shell(rings, 1.02, s * th, 0.0008) for th in (32, 42, 52)]
        parts.append(strip(f'pocket{s}', [p for p, _ in pw], [n for _, n in pw], 0.009, 0.004, trim))
    root = at_zero(join(parts, 'outfit_jacket'), R.TORSO)
    return build_sleeves(root, JACKET_SLEEVE, [paint, trim], stripe_mat=trim)


# ---------------------------------------------------------------- outfit_poncho (+ shape key `seated`)
def outfit_poncho():
    m = mat('Poncho', 'poncho_yellow', roughness=0.28)
    snap = mat('Poncho_Snap', 'cream', roughness=0.4)
    rings = [(0.716, 0.420, 0.282, 0.012), (0.728, 0.430, 0.292, 0.012), (0.742, 0.422, 0.284, 0.012),
             (0.90, 0.398, 0.262, 0.010), (1.05, 0.370, 0.240, 0.006), (1.20, 0.336, 0.214, 0.0),
             (1.29, 0.294, 0.190, 0.0), (1.335, 0.236, 0.160, 0.0), (1.370, 0.135, 0.112, 0.004),
             (1.392, 0.090, 0.080, 0.006), (1.405, 0.086, 0.076, 0.006)]
    body = loft('poncho', rings, 16, [m], cap_bottom=False, cap_top=False)
    # hood folded on the back: teardrop hanging from the neckline
    hood = tuft('hood', (0, 0.130, 1.400), (0, 0.235, 1.205), 0.27, 0.09, m, (0, 1, 0), segs=8,
                profile=(0.92, 1.0, 0.84, 0.52))
    parts = [body, hood]
    for i, z in enumerate((1.30, 1.18, 1.06)):
        lo_r = max(r for r in rings if r[0] <= z)
        hi_r = min(r for r in rings if r[0] >= z)
        t = (z - lo_r[0]) / max(hi_r[0] - lo_r[0], 1e-6)
        front_y = (lo_r[3] - lo_r[2]) + ((hi_r[3] - hi_r[2]) - (lo_r[3] - lo_r[2])) * t
        parts.append(disc(f'snap{i}', Vector((0.0, front_y - 0.003, z)), Vector((0, -1, 0.1)), 0.014, 0.008, snap))
    obj = join(parts, 'outfit_poncho')
    add_seated_key(obj)
    return at_zero(obj, R.TORSO)


def add_seated_key(obj):
    """Shape key `seated`: front panel slopes forward from the belly over the thighs and hangs past the knees;
    back hem lifts off the seat. Tuned for hips 0..+0.05 above the standing height with thighs -1.25..-1.35 rad."""
    fold_z, knee_y = 0.955, -0.47
    obj.shape_key_add(name='Basis', from_mix=False)
    key = obj.shape_key_add(name='seated', from_mix=False)
    for i, v in enumerate(obj.data.vertices):
        p = v.co.copy()
        if p.z >= fold_z:
            continue
        ang = math.atan2(p.x, -p.y)
        c = math.cos(ang)
        wf = max(0.0, min(1.0, (c - 0.15) / 0.55))
        wb = max(0.0, min(1.0, (-c - 0.1) / 0.5))
        d = fold_z - p.z
        y0 = p.y
        run = max(0.0, y0 - knee_y)
        if d <= run:
            t = d / max(run, 1e-3)
            front = Vector((p.x * 0.98, y0 - d, fold_z + 0.03 - 0.075 * t))
        else:
            front = Vector((p.x * 0.98, knee_y - 0.02, fold_z - 0.045 - (d - run)))
        back = Vector((p.x, p.y + d * 0.55, fold_z - d * 0.5))
        q = p.lerp(front, wf) if wf > 0 else p
        q = q.lerp(back, wb) if wb > 0 else q
        key.data[i].co = q


run_family(ctx, {'outfit_vest': outfit_vest, 'outfit_hood': outfit_hood, 'outfit_jacket': outfit_jacket,
                 'outfit_poncho': outfit_poncho}, socket='torso', close_up=False)


def posed_sleeves_preview():
    """Runtime rule in action: outfit on `torso`, sleeves re-parented onto arm_* / forearm_*, RIDER pose."""
    clear_scene()
    objs = []
    for i, (name, yaw) in enumerate((('outfit_hood', -35), ('outfit_jacket', -35), ('outfit_jacket', 150),
                                     ('outfit_hood', 115))):
        nodes = import_body(ctx)
        new, roots = import_glb(os.path.join(ctx.models_dir, name + '.glb'))
        attach(roots[0], nodes['torso'])
        reparent_sleeves(nodes, roots[0])
        for o in list(nodes.values()) + new:
            o.rotation_mode = 'XYZ'
        apply_pose(nodes, RIDER)
        nodes['hips'].location = ((i - 1.5) * 0.85, 0, 0.62)  # seated height: feet on the ground
        nodes['hips'].rotation_euler = (0, 0, math.radians(yaw))
        objs += [o for o in list(nodes.values()) + new if o.type == 'MESH']
    render(ctx, 'outfit_sleeves__posed', objs=objs, res=(1400, 560), elev=24, azim=0, lens=70, margin=1.04)


if ctx.want_preview() and (wants(ctx, 'outfit_hood') or wants(ctx, 'outfit_jacket')):
    posed_sleeves_preview()
print('[char_outfits] OK')
