"""props_street helpers: cheap, rounded builders for the toy-diorama street props.

Everything here produces plain mesh objects that are later joined into ONE mesh per prop
(props are instanced hundreds of times, so every triangle and material counts).

- lathe(): revolve an (r, z) profile -> pots, stools, cones, canopies, chickens. Exact tri control.
- tube(): tapered tube along a polyline (parallel-transport frames) -> trunks, limbs, handles, pipes.
- leaf(): folded leaf strip (lance / paddle / serrated frond) with up-facing normals.
- blob(): jittered icosphere -> foliage puffs, flower clusters.
- finish(): join + apply transforms + angle smoothing + weighted normals (rounded toy shading).
- run_assets(): per-asset build -> export -> preview loop with `--only <name>` filtering.
"""
import math
import random

import bpy
from mathutils import Vector, Matrix, Euler

from .palette import mat
from .shapes import join
from .bootstrap import clear_scene
from .export import export_glb
from .preview import render_preview


# --------------------------------------------------------------------------------------------- materials
def M(name, color_key, double=False, **kw):
    """Contract-aware material getter. Solid props are single-sided; thin sheets (leaves/canvas) double-sided."""
    m = mat(name, color_key, **kw)
    m.use_backface_culling = not double
    return m


# --------------------------------------------------------------------------------------------- low level
def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def smooth(obj, angle=50):
    _activate(obj)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle), keep_sharp_edges=False)
    return obj


def mesh_obj(name, verts, faces, mats, face_mats=None, smooth_angle=50, loc=(0, 0, 0), rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    for m in mats:
        me.materials.append(m)
    if face_mats is not None:
        me.polygons.foreach_set('material_index', list(face_mats))
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if smooth_angle is not None:
        smooth(obj, smooth_angle)
    return obj


def place(obj, loc=(0, 0, 0), rot=(0, 0, 0), scale=None):
    obj.location = loc
    obj.rotation_euler = rot
    if scale is not None:
        obj.scale = scale
    return obj


# --------------------------------------------------------------------------------------------- lathe
def lathe(name, profile, mats, segs=12, loc=(0, 0, 0), rot=(0, 0, 0), cap_bottom=False, cap_top=False,
          band_mat=None, face_mat=None, wobble=None, phase=0.0, sx=1.0, sy=1.0, smooth_angle=50):
    """Revolve `profile` [(r, z), ...] (bottom -> top) around local Z.

    r <= 0 makes a pole vertex (closed tip). band_mat[i] = material index for band i (between profile
    points i and i+1); face_mat(band, seg) overrides it. wobble(i, k) -> (dr, dz) perturbs ring i vertex k.
    Faces point outward when the profile runs bottom -> top on the outside.
    """
    if isinstance(mats, bpy.types.Material):
        mats = [mats]
    verts, faces, fmats, rings = [], [], [], []
    for i, (r, z) in enumerate(profile):
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
            continue
        ring = []
        for k in range(segs):
            a = phase + 2 * math.pi * k / segs
            dr, dz = wobble(i, k) if wobble else (0.0, 0.0)
            rr = r + dr
            ring.append(len(verts))
            verts.append((rr * math.cos(a) * sx, rr * math.sin(a) * sy, z + dz))
        rings.append(ring)
    for b, (ra, rb) in enumerate(zip(rings, rings[1:])):
        if len(ra) == 1 and len(rb) == 1:
            continue
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(ra) == 1:
                f = (ra[0], rb[k2], rb[k])
            elif len(rb) == 1:
                f = (ra[k], ra[k2], rb[0])
            else:
                f = (ra[k], ra[k2], rb[k2], rb[k])
            faces.append(f)
            mi = face_mat(b, k) if face_mat else (band_mat[b] if band_mat else 0)
            fmats.append(mi)
    if cap_bottom and len(rings[0]) > 1:
        faces.append(tuple(reversed(rings[0])))
        fmats.append(band_mat[0] if band_mat else 0)
    if cap_top and len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
        fmats.append(band_mat[-1] if band_mat else 0)
    return mesh_obj(name, verts, faces, mats, fmats, smooth_angle, loc, rot)


# --------------------------------------------------------------------------------------------- tube
def tube(name, pts, radii, mats, segs=6, cap_start=True, cap_end=True, smooth_angle=60, band_mat=None,
         flat=None):
    """Tapered tube through world points `pts` with per-point `radii` (0 -> pointed end).

    flat=(fx, fy) squashes the cross-section (fx along the frame normal, fy along the binormal).
    """
    if isinstance(mats, bpy.types.Material):
        mats = [mats]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(pts)
    P = [Vector(p) for p in pts]
    n = len(P)
    T = []
    for i in range(n):
        if i == 0:
            t = P[1] - P[0]
        elif i == n - 1:
            t = P[-1] - P[-2]
        else:
            t = (P[i + 1] - P[i]).normalized() + (P[i] - P[i - 1]).normalized()
        T.append(t.normalized())
    ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = (ref - T[0] * ref.dot(T[0])).normalized()
    fx, fy = flat if flat else (1.0, 1.0)
    verts, faces, fmats, rings = [], [], [], []
    for i in range(n):
        if i > 0:
            nrm = (nrm - T[i] * nrm.dot(T[i])).normalized()
        b = T[i].cross(nrm)
        r = radii[i]
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append(tuple(P[i]))
            continue
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            v = P[i] + nrm * (math.cos(a) * r * fx) + b * (math.sin(a) * r * fy)
            ring.append(len(verts))
            verts.append(tuple(v))
        rings.append(ring)
    for bi, (ra, rb) in enumerate(zip(rings, rings[1:])):
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(ra) == 1:
                f = (ra[0], rb[k2], rb[k])
            elif len(rb) == 1:
                f = (ra[k], ra[k2], rb[0])
            else:
                f = (ra[k], ra[k2], rb[k2], rb[k])
            faces.append(f)
            fmats.append(band_mat[bi] if band_mat else 0)
    if cap_start and len(rings[0]) > 1:
        faces.append(tuple(reversed(rings[0])))
        fmats.append(0)
    if cap_end and len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
        fmats.append(band_mat[-1] if band_mat else 0)
    return mesh_obj(name, verts, faces, mats, fmats, smooth_angle)


def arc_points(p0, p1, lift, n):
    """n+1 points from p0 to p1 bulging up by `lift` in the middle (parabola)."""
    a, b = Vector(p0), Vector(p1)
    out = []
    for i in range(n + 1):
        u = i / n
        p = a.lerp(b, u)
        p.z += lift * 4 * u * (1 - u)
        out.append(tuple(p))
    return out


# --------------------------------------------------------------------------------------------- leaf
def leaf(name, base, yaw, length, width, mats, segs=4, rise=0.6, droop=0.5, fold=0.25, shape='lance',
         roll=0.0, serrate=0.0, ragged=0.0, two_tone=False, seed=0, curl=0.0):
    """Folded leaf strip starting at `base`, pointing along `yaw` (radians, 0 = +X).

    rise: initial pitch (rad); droop: downward bend (fraction of length); fold: V-fold depth (fraction of width).
    shape: 'lance' (pointed ends) | 'paddle' (banana: petiole then broad blade, round tip) | 'frond' (palm).
    serrate: zig-zag edge depth (0..1) for fronds; ragged: random torn-edge width loss (banana).
    two_tone: left half uses material 0, right half material 1 (mats must hold 2 materials).
    """
    if isinstance(mats, bpy.types.Material):
        mats = [mats]
    rng = random.Random(seed)
    L = length

    def wid(u, i):
        if shape == 'paddle':
            w = width * (min(1.0, u / 0.18) ** 0.8) * (1.0 - max(0.0, (u - 0.72) / 0.28) ** 2.2)
            w = max(w, width * 0.06)
        elif shape == 'frond':
            w = width * (math.sin(math.pi * min(1.0, u * 0.9 + 0.08)) ** 0.6)
        else:
            w = width * (math.sin(math.pi * u) ** 0.75)
        if serrate and i % 2 == 1:
            w *= (1.0 - serrate)
        if ragged:
            w *= 1.0 - ragged * rng.random()
        return w

    def centre(u):
        x = L * u * math.cos(rise)
        z = L * u * math.sin(rise) - droop * L * u * u
        return Vector((x, 0.0, z))

    verts, faces, fmats = [], [], []
    mids, lefts, rights = [], [], []
    for i in range(segs):
        u = i / segs
        c = centre(u)
        w = wid(u, i) if i > 0 else width * (0.08 if shape != 'lance' else 0.04)
        crl = curl * u
        mids.append(len(verts))
        verts.append(c)
        lefts.append(len(verts))
        verts.append(c + Vector((0.0, w * 0.5, -fold * w * 0.5 + crl * w)))
        rights.append(len(verts))
        verts.append(c + Vector((0.0, -w * 0.5, -fold * w * 0.5 + crl * w)))
    tip = len(verts)
    verts.append(centre(1.0))
    for i in range(segs - 1):
        faces.append((mids[i], mids[i + 1], lefts[i + 1], lefts[i]))
        fmats.append(0)
        faces.append((rights[i], rights[i + 1], mids[i + 1], mids[i]))
        fmats.append(1 if two_tone else 0)
    faces.append((mids[-1], tip, lefts[-1]))
    fmats.append(0)
    faces.append((rights[-1], tip, mids[-1]))
    fmats.append(1 if two_tone else 0)
    mrot = Euler((roll, 0.0, yaw)).to_matrix()
    b = Vector(base)
    verts = [tuple(mrot @ v + b) for v in verts]
    return mesh_obj(name, verts, faces, mats, fmats, smooth_angle=75)


# --------------------------------------------------------------------------------------------- blob
def blob(name, radius, loc, material, scale=(1, 1, 1), subdiv=2, jitter=0.07, seed=0, flat_bottom=None):
    """Jittered icosphere puff (subdiv 1 = 20 tris, 2 = 80 tris). flat_bottom squashes verts below that z."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    rng = random.Random(seed)
    for v in obj.data.vertices:
        n = v.co.normalized()
        v.co = v.co + n * radius * rng.uniform(-jitter, jitter)
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        if flat_bottom is not None and v.co.z < flat_bottom:
            v.co.z = flat_bottom + (v.co.z - flat_bottom) * 0.25
    obj.data.materials.append(material)
    obj.data.polygons.foreach_set('use_smooth', [True] * len(obj.data.polygons))
    obj.data.update()
    obj.location = loc
    return obj


# --------------------------------------------------------------------------------------------- deform
def taper(obj, top_scale, axis_center=(0.0, 0.0)):
    """Scale X/Y of an object's mesh linearly with height (1 at the bottom -> top_scale at the top)."""
    vs = obj.data.vertices
    zs = [v.co.z for v in vs]
    lo, hi = min(zs), max(zs)
    cx, cy = axis_center
    for v in vs:
        t = (v.co.z - lo) / max(hi - lo, 1e-6)
        s = 1.0 + (top_scale - 1.0) * t
        v.co.x = cx + (v.co.x - cx) * s
        v.co.y = cy + (v.co.y - cy) * s
    obj.data.update()
    return obj


# --------------------------------------------------------------------------------------------- finish
def finish(objs, name, weighted=True, smooth_angle=None):
    """Join parts into one mesh named `name`, origin at world origin, rounded toy shading."""
    objs = [o for o in objs if o is not None]
    costs = {}
    for p in objs:
        p.data.calc_loop_triangles()
        key = p.name.rstrip('0123456789.')
        costs[key] = costs.get(key, 0) + len(p.data.loop_triangles)
    top = sorted(costs.items(), key=lambda kv: -kv[1])[:10]
    print(f'[parts] {name}: ' + ', '.join(f'{k}={v}' for k, v in top))
    o = join(objs, name)
    _activate(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if smooth_angle is not None:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle), keep_sharp_edges=True)
    if weighted:
        wn = o.modifiers.new('WeightedNormal', 'WEIGHTED_NORMAL')
        wn.keep_sharp = True
        wn.mode = 'FACE_AREA'
        wn.weight = 50
    return o


def run_assets(ctx, builders, preview_views=None):
    """builders: list of (name, build_fn, max_tris). `--only a,b` in the CLI flags limits the run."""
    only = None
    if '--only' in ctx.flags:
        i = ctx.flags.index('--only')
        if i + 1 < len(ctx.flags):
            only = set(ctx.flags[i + 1].split(','))
    views = preview_views or {}
    for name, fn, budget in builders:
        if only and name not in only:
            continue
        clear_scene()
        obj = fn()
        export_glb(ctx, name, [obj], max_tris=None if '--nobudget' in ctx.flags else budget)
        d = obj.dimensions
        print(f'[props_street] {name} size X{d.x:.2f} Y{d.y:.2f} Z{d.z:.2f} mats={[m.name for m in obj.data.materials]}')
        render_preview(ctx, name, [obj], **views.get(name, {}))


# --------------------------------------------------------------------------------------------- canopy
def canopy(name, radius, apex_z, edge_z, mats, panels=8, sub=3, valance=0.13, puff=0.05,
           ring_fracs=(0.2, 0.55, 0.82), dome=1.6):
    """Puffy striped umbrella canopy + scalloped valance (both double-sided Canvas materials).

    Ribs sit on every `sub`-th vertex; panels alternate material 0/1 and bulge out/up between ribs, so the
    rim scallops naturally. Valance flaps use the opposite colour of their panel. Returns
    (canopy_obj, valance_obj, rib_tips). dome = profile exponent (1.6 cone-ish, 2.5+ rounder dome).
    """
    segs = panels * sub
    h = apex_z - edge_z
    prof = [(0.0, apex_z)] + [(radius * f, apex_z - h * (f ** dome)) for f in ring_fracs] + [(radius, edge_z)]
    last = len(prof) - 1

    def bulge(k):
        return math.sin(math.pi * (k % sub) / sub)

    def wob(i, k):
        b = bulge(k)
        if i == 0:
            return (0.0, 0.0)
        if i == last:
            return (0.0, puff * 0.5 * b)
        f = prof[i][0] / radius
        return (puff * 0.8 * b * f, puff * 0.9 * b * f)

    can = lathe(name, prof, mats, segs=segs, face_mat=lambda b, k: (k // sub) % 2, wobble=wob, smooth_angle=80)
    verts, faces, fmats, tips = [], [], [], []
    for p in range(panels):
        ids = []
        for j in range(sub + 1):
            k = p * sub + j
            a = 2 * math.pi * (k % segs) / segs
            b = bulge(k) if j not in (0, sub) else 0.0
            zt = edge_z + puff * 0.5 * b
            r = radius + 0.006
            top = (r * math.cos(a), r * math.sin(a), zt + 0.004)
            rb = r + 0.025
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


# --------------------------------------------------------------------------------------------- petal cards
def petal_cards(name, centres, normals, sizes, material, petals=3, lift=0.012, seed=0):
    """Flat star-shaped cards (bougainvillea bracts / blossom flecks) lying on a surface.

    Each card = 2*petals triangles; faces point along the given normal (no double-siding needed).
    """
    rng = random.Random(seed)
    verts, faces = [], []
    for c, n, s in zip(centres, normals, sizes):
        n = Vector(n).normalized()
        ref = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
        t = (ref - n * ref.dot(n)).normalized()
        b = n.cross(t)
        base = Vector(c) + n * lift
        ci = len(verts)
        verts.append(tuple(base + n * s * 0.15))
        a0 = rng.uniform(0, 2 * math.pi)
        ring = []
        for k in range(petals * 2):
            a = a0 + math.pi * k / petals
            r = s if k % 2 == 0 else s * 0.42
            ring.append(len(verts))
            verts.append(tuple(base + (t * math.cos(a) + b * math.sin(a)) * r))
        m = len(ring)
        for k in range(m):
            faces.append((ci, ring[k], ring[(k + 1) % m]))
    return mesh_obj(name, verts, faces, [material], smooth_angle=60)


def ellipsoid_points(centre, radii, count, z_min=-1.0, seed=0, jitter=0.0):
    """Fibonacci points on an ellipsoid (upper part when z_min > -1); returns (points, normals)."""
    rng = random.Random(seed)
    golden = math.pi * (3 - math.sqrt(5))
    pts, nrms = [], []
    cx, cy, cz = centre
    rx, ry, rz = radii
    for i in range(count):
        zu = 1 - (i + 0.5) / count * (1 - z_min)
        rr = math.sqrt(max(0.0, 1 - zu * zu))
        a = i * golden + rng.uniform(-jitter, jitter)
        ux, uy = rr * math.cos(a), rr * math.sin(a)
        pts.append((cx + rx * ux, cy + ry * uy, cz + rz * zu))
        nrms.append(Vector((ux / rx, uy / ry, zu / rz)).normalized())
    return pts, nrms


def surface_scatter(objs, centre, count, z_min=-0.2, seed=0, accept=None):
    """Ray-cast Fibonacci directions from outside toward `centre`; returns (points, normals, hit_objects)
    on the OUTERMOST surface of `objs` (world space). `accept(obj)` filters which surfaces receive points."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    trees = []
    for o in objs:
        mw = o.matrix_world
        vs = [mw @ v.co for v in o.data.vertices]
        trees.append((o, BVHTree.FromPolygons(vs, [tuple(p.vertices) for p in o.data.polygons])))
    c = Vector(centre)
    dirs, _ = ellipsoid_points((0, 0, 0), (1, 1, 1), count, z_min=z_min, seed=seed, jitter=0.3)
    pts, nrms, hits = [], [], []
    for d in dirs:
        d = Vector(d).normalized()
        origin = c + d * 50.0
        best = None
        for o, t in trees:
            loc, nrm, _i, dist = t.ray_cast(origin, -d)
            if loc is not None and (best is None or dist < best[3]):
                best = (loc, nrm, o, dist)
        if best is None or (accept and not accept(best[2])):
            continue
        pts.append(tuple(best[0]))
        nrms.append(best[1])
        hits.append(best[2])
    return pts, nrms, hits


# --------------------------------------------------------------------------------------------- lumpy foliage
def lumpy(name, radius, loc, mats, scale=(1, 1, 1), subdiv=3, lump=0.12, freq=2.2, seed=0,
          patch_mat=None, patch_thresh=0.1, patch_freq=3.2, patch_push=0.07, patch_zbias=0.3,
          top_mat=None, top_thresh=0.45, flat_bottom=None):
    """Noise-displaced icosphere (subdiv 3 = 320 tris) for cartoon foliage masses.

    mats[0] = base colour; `patch_mat` (index) marks raised noise patches (flower clusters / light leaf
    clumps, biased upward by patch_zbias); `top_mat` (index) colours upward-facing non-patch faces.
    """
    from mathutils import noise
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    off = Vector((seed * 7.31 + 0.5, seed * 3.17 + 1.3, seed * 5.53 + 2.1))
    pk = {}
    for v in obj.data.vertices:
        n = v.co.normalized()
        d = noise.noise(n * freq + off)
        p = (noise.noise(n * patch_freq + off * 1.7) + patch_zbias * n.z) if patch_mat is not None else -9.0
        pk[v.index] = p
        r = radius * (1.0 + lump * d + (patch_push if p > patch_thresh else 0.0))
        co = n * r
        co = Vector((co.x * scale[0], co.y * scale[1], co.z * scale[2]))
        if flat_bottom is not None and co.z < flat_bottom:
            co.z = flat_bottom + (co.z - flat_bottom) * 0.3
        v.co = co
    obj.data.update()
    for m in mats:
        obj.data.materials.append(m)
    idx = []
    for poly in obj.data.polygons:
        ps = [pk[i] for i in poly.vertices]
        if patch_mat is not None and sum(ps) / len(ps) > patch_thresh:
            idx.append(patch_mat)
        elif top_mat is not None and poly.normal.z > top_thresh and noise.noise(poly.center * 3.0 + off) > -0.1:
            idx.append(top_mat)
        else:
            idx.append(0)
    obj.data.polygons.foreach_set('material_index', idx)
    obj.data.polygons.foreach_set('use_smooth', [True] * len(obj.data.polygons))
    obj.data.update()
    obj.location = loc
    return obj
