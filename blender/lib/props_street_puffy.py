"""Pillowy toy umbrella canopy for the props_street group (prop_umbrella, prop_food_cart).

Unlike props_street_kit.canopy() (two rings -> a faceted cone), every panel here is an inflated cushion:
  * 4-5 radial rings on a domed base profile z = apex - h * f**dome (f = radius fraction),
  * each panel bulges along the dome NORMAL by puff * b(k) * s(f): b = sin across the panel (0 on the ribs),
    s = sin(pi * f) ** 0.7 radially (0 at the apex, peak mid-panel, eases off towards the rim),
  * the rim rises between rib tips (scallop) and a scalloped valance hangs from it (opposite stripe colour).
Returns (canopy_obj, valance_obj, rib_tips) exactly like the kit version, so callers can swap it in.
"""
import math
from lib.props_street_kit import lathe, mesh_obj


def soft_normals(obj, inside):
    """props_street_kit.finish() adds a FACE_AREA WeightedNormal modifier (keeps toy blocks flat) that makes curved
    fabric look faceted. Exempt the vertices where inside(co) is True (e.g. the canopy) via an inverted group."""
    vg = obj.vertex_groups.new(name='soft_normals')
    vg.add([v.index for v in obj.data.vertices if inside(v.co)], 1.0, 'REPLACE')
    for mod in obj.modifiers:
        if mod.type == 'WEIGHTED_NORMAL':
            mod.vertex_group = vg.name
            mod.invert_vertex_group = True
    return obj


def _dome(radius, apex_z, edge_z, dome, f):
    h = apex_z - edge_z
    z = apex_z - h * (f ** dome)
    slope = h * dome * (f ** (dome - 1)) / radius if f > 0 else 0.0   # -dz/dr
    n = math.hypot(slope, 1.0)
    return z, (slope / n, 1.0 / n)                                       # outward-up unit normal (r, z)


def puffy_canopy(name, radius, apex_z, edge_z, mats, panels=8, sub=4, valance=0.13, puff=0.10, scallop=0.05,
                 ring_fracs=(0.2, 0.38, 0.55, 0.7, 0.85), dome=2.4, flap_out=0.025):
    segs = panels * sub
    fracs = list(ring_fracs) + [1.0]
    prof = [(0.0, apex_z)] + [(radius * f, _dome(radius, apex_z, edge_z, dome, f)[0]) for f in fracs]
    last = len(prof) - 1

    def bulge(k):
        return math.sin(math.pi * (k % sub) / sub)

    def wob(i, k):
        if i == 0:
            return (0.0, 0.0)
        b = bulge(k)
        if i == last:
            return (0.0, scallop * b)
        f = fracs[i - 1]
        _z, (nr, nz) = _dome(radius, apex_z, edge_z, dome, f)
        s = math.sin(math.pi * f) ** 0.7
        return (puff * b * s * nr, puff * b * s * nz)

    can = lathe(name, prof, mats, segs=segs, face_mat=lambda b, k: (k // sub) % 2, wobble=wob, smooth_angle=80)
    can.data.flip_normals()     # profile runs apex -> rim (top -> bottom): flip so the fabric faces up/out
    verts, faces, fmats, tips = [], [], [], []
    for p in range(panels):
        ids = []
        for j in range(sub + 1):
            k = p * sub + j
            a = 2 * math.pi * (k % segs) / segs
            b = bulge(k) if j not in (0, sub) else 0.0
            r = radius + 0.006
            top = (r * math.cos(a), r * math.sin(a), edge_z + scallop * b + 0.004)
            rb = r + flap_out
            bot = (rb * math.cos(a), rb * math.sin(a), edge_z - valance * (0.25 + 1.0 * b))
            ids.append((len(verts), len(verts) + 1))
            verts += [top, bot]
            if j == 0:
                tips.append((radius * 0.96 * math.cos(a), radius * 0.96 * math.sin(a), edge_z - 0.01))
        for j in range(sub):
            (t0, b0), (t1, b1) = ids[j], ids[j + 1]
            faces.append((b0, b1, t1, t0))
            fmats.append(1 - (p % 2))
    val = mesh_obj(name + '_val', verts, faces, mats, fmats, smooth_angle=80)
    return can, val, tips
