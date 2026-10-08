"""Story overlays and weather built as geometry so they render in-camera with the scene's DOF:
gram route (cyan dashes + chevrons), the cyan ring under the hero, the coral pin, rain streaks + ripples,
exhaust puffs and the coin / banknote motif.
"""
import math
import random
import bpy
from mathutils import Vector
from story.kit.assets import rgba
from story.kit.stage import smat


def _mesh(name, verts, faces, mat, uvs=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs[me.loops[li].vertex_index]
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = smooth
    me.validate()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def glow_mat(name, color, strength):
    return smat(name, color, rough=0.4, emission=strength)


def spline(points, step=0.05):
    """Catmull-Rom through `points` (z kept), resampled every ~step metres -> list of Vectors."""
    p = [Vector(v) for v in points]
    p = [p[0] + (p[0] - p[1])] + p + [p[-1] + (p[-1] - p[-2])]
    out = []
    for i in range(1, len(p) - 2):
        a, b, c, d = p[i - 1], p[i], p[i + 1], p[i + 2]
        n = max(2, int((c - b).length / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3))
    out.append(p[-2])
    return out


def route(points, z=0.012, width=0.24, dash=0.8, gap=0.55, chevron_every=4, color='gram_cyan', strength=5.0,
          fade_start=0.0):
    """gram route ribbon: dashes along a smooth curve with a chevron every `chevron_every` dashes."""
    pts = spline([(p[0], p[1], 0.0) for p in points])   # ground-plane curve (2D or 3D input)
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + (b - a).length)

    def at(s):
        for i in range(1, len(cum)):
            if cum[i] >= s:
                t = (s - cum[i - 1]) / max(cum[i] - cum[i - 1], 1e-6)
                p = pts[i - 1].lerp(pts[i], t)
                d = (pts[i] - pts[i - 1]).normalized()
                return p, d
        return pts[-1], (pts[-1] - pts[-2]).normalized()

    verts, faces = [], []
    s, k = fade_start, 0
    while s + dash < cum[-1]:
        if chevron_every and k % chevron_every == chevron_every - 1:
            p, d = at(s + dash * 0.5)
            side = Vector((-d.y, d.x, 0))
            tip = p + d * 0.3
            for sgn in (1, -1):  # two arms of a 'V' pointing along the route
                back = tip - d * 0.4 + side * sgn * width * 1.7
                arm = (back - tip).normalized()
                nrm = Vector((-arm.y, arm.x, 0)) * width * 0.4
                i = len(verts)
                verts += [tip - nrm, back - nrm, back + nrm, tip + nrm]
                faces.append((i, i + 1, i + 2, i + 3))
        else:
            n = 4
            ring = []
            for j in range(n + 1):
                p, d = at(s + dash * j / n)
                side = Vector((-d.y, d.x, 0)) * width / 2
                ring.append((p + side, p - side))
            for j in range(n):
                i = len(verts)
                verts += [ring[j][0], ring[j][1], ring[j + 1][1], ring[j + 1][0]]
                faces.append((i, i + 1, i + 2, i + 3))
        s += dash + gap
        k += 1
    verts = [Vector((v.x, v.y, z)) for v in verts]
    return _mesh('St_Route', verts, faces, glow_mat('St_RouteGlow', color, strength))


def ring(center, radius=1.25, tube=0.04, color='gram_cyan', strength=5.0, name='St_Ring', segs=64):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=tube, major_segments=segs, minor_segments=8,
                                     location=Vector(center) + Vector((0, 0, tube * 0.4)))
    o = bpy.context.active_object
    o.name = name
    o.scale = (1, 1, 0.35)
    o.data.materials.append(glow_mat(name + '_Mat', color, strength))
    bpy.ops.object.shade_smooth()
    return o


def pin(loc, scale=1.0, color='pin_coral', strength=1.2, name='St_Pin'):
    """Map pin: a coral sphere head over a cone tip, white disc both sides. loc = tip position."""
    s = scale
    mat = smat(name + '_Coral', color, rough=0.3, emission=strength, coat=0.6)
    white = smat(name + '_White', 'cream', rough=0.4, emission=strength * 0.6)
    tip = Vector(loc)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.5 * s, location=tip + Vector((0, 0, 1.15 * s)))
    head = bpy.context.active_object
    head.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.43 * s, radius2=0.0, depth=0.95 * s,
                                    location=tip + Vector((0, 0, 0.62 * s)), rotation=(math.pi, 0, 0))
    cone = bpy.context.active_object
    cone.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.21 * s, depth=1.02 * s,
                                        location=tip + Vector((0, 0, 1.15 * s)), rotation=(math.pi / 2, 0, 0))
    dot = bpy.context.active_object
    dot.data.materials.append(white)
    bpy.ops.object.shade_smooth()
    for o in (head, cone, dot):
        o.name = name
    return [head, cone, dot]


def rain(center, size, count, cam, length=(0.28, 0.6), width=0.005, wind=(0.12, 0.05), seed=7, strength=1.0,
         alpha=0.4, color=(0.78, 0.86, 1.0), near=2.5, name='St_Rain'):
    """Camera-facing streak quads with faded ends, scattered in a box (centre, size); nothing closer than `near`
    metres to the camera (those would smear across the frame)."""
    rnd = random.Random(seed)
    c, sz, cam = Vector(center), Vector(size), Vector(cam)
    d = Vector((wind[0], wind[1], -1.0)).normalized()
    verts, faces, uvs = [], [], []
    for _ in range(count):
        p = c + Vector(((rnd.random() - 0.5) * sz.x, (rnd.random() - 0.5) * sz.y, (rnd.random() - 0.5) * sz.z))
        if (p - cam).length < near:
            continue
        half = rnd.uniform(*length) / 2
        side = d.cross(p - cam)
        if side.length < 1e-6:
            continue
        side = side.normalized() * width / 2
        i = len(verts)
        verts += [p - d * half - side, p - d * half + side, p + d * half + side, p + d * half - side]
        uvs += [(0, 0), (1, 0), (1, 1), (0, 1)]
        faces.append((i, i + 1, i + 2, i + 3))
    m = bpy.data.materials.new(name + '_Mat')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    uv = nt.nodes.new('ShaderNodeUVMap')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    fade = nt.nodes.new('ShaderNodeValToRGB')   # 0 at both streak ends -> 1 in the middle
    els = fade.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0, 0, 0, 1)
    els[1].position, els[1].color = 1.0, (0, 0, 0, 1)
    mid = els.new(0.5)
    mid.color = (alpha, alpha, alpha, 1)
    nt.links.new(uv.outputs['UV'], sep.inputs[0])
    nt.links.new(sep.outputs['Y'], fade.inputs['Fac'])
    nt.links.new(fade.outputs['Color'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    obj = _mesh(name, verts, faces, m, uvs=[Vector((u, v)) for u, v in uvs])
    obj.visible_shadow = False
    return obj


def ripples(area, count, z=0.004, r=(0.05, 0.16), seed=3, strength=0.6, name='St_Ripples'):
    """Raindrop rings on wet ground: area = (x0, x1, y0, y1); thin flat annuli."""
    rnd = random.Random(seed)
    verts, faces = [], []
    segs = 14
    for _ in range(count):
        cx, cy = rnd.uniform(area[0], area[1]), rnd.uniform(area[2], area[3])
        rad = rnd.uniform(*r)
        w = rad * 0.16
        i = len(verts)
        for k in range(segs):
            a = 2 * math.pi * k / segs
            ca, sa = math.cos(a), math.sin(a)
            verts += [(cx + ca * (rad - w), cy + sa * (rad - w), z), (cx + ca * rad, cy + sa * rad, z)]
        for k in range(segs):
            a0, b0 = i + 2 * k, i + 2 * k + 1
            a1, b1 = i + 2 * ((k + 1) % segs), i + 2 * ((k + 1) % segs) + 1
            faces.append((a0, b0, b1, a1))
    mat = smat(name + '_Mat', (0.85, 0.9, 1.0), rough=0.1, emission=strength)
    obj = _mesh(name, verts, faces, mat)
    obj.visible_shadow = False
    return obj


def puffs(spots, color=(0.32, 0.31, 0.3), alpha=0.82, seed=11, name='St_Puff'):
    """Cartoon smoke: spots = [(centre, radius, lighten 0..1)], each a cluster of 4-6 spheres whose rims fade
    out (facing-ratio alpha), so the clouds read soft instead of like solid balls."""
    rnd = random.Random(seed)
    objs = []
    for idx, (cen, rad, lift) in enumerate(spots):
        col = tuple(min(1.0, c + (0.75 - c) * lift) for c in rgba(color)[:3])
        m = bpy.data.materials.new(f'{name}_{idx}')
        m.use_nodes = True
        nt = m.node_tree
        out = nt.nodes['Material Output']
        b = nt.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*col, 1)
        b.inputs['Roughness'].default_value = 1.0
        b.inputs['Sheen Weight'].default_value = 0.6
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        lw = nt.nodes.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.35
        ramp = nt.nodes.new('ShaderNodeValToRGB')   # facing (0 = rim .. 1 = centre) -> opacity
        a = max(0.05, alpha - 0.3 * lift)
        ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.0, (0, 0, 0, 1)
        ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.55, (a, a, a, 1)
        inv = nt.nodes.new('ShaderNodeMath')
        inv.operation = 'SUBTRACT'
        inv.inputs[0].default_value = 1.0
        nt.links.new(lw.outputs['Facing'], inv.inputs[1])
        nt.links.new(inv.outputs[0], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(b.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        for _ in range(rnd.randint(4, 6)):
            off = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.6, 0.8))) * rad * 0.5
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=rad * rnd.uniform(0.5, 0.75),
                                                 location=Vector(cen) + off)
            o = bpy.context.active_object
            o.name = name
            o.data.materials.append(m)
            o.visible_shadow = lift < 0.5
            bpy.ops.object.shade_smooth()
            objs.append(o)
    return objs


def coins(spots, radius=0.07, glow=0.15, seed=5, name='St_Coin'):
    """Gold baht coins: spots = [(loc, tilt_deg)]."""
    rnd = random.Random(seed)
    gold = smat(name + '_Gold', '#F2C14E', rough=0.28, metal=0.85, emission=glow)
    rim = smat(name + '_Rim', '#E0A92E', rough=0.3, metal=0.9)
    out = []
    for loc, tilt in spots:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=radius * 0.23, location=loc,
                                            rotation=(math.radians(tilt), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6.28)))
        c = bpy.context.active_object
        c.name = name
        c.data.materials.append(gold)
        c.data.materials.append(rim)
        for p in c.data.polygons:
            p.material_index = 0 if abs(p.normal.z) > 0.5 else 1
        mod = c.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = 0.005, 2
        out.append(c)
    return out


def notes(spots, seed=9, name='St_Note'):
    """Baht notes: spots = [(loc, (rx, ry, rz) deg, colour)], a printed panel inset on both faces."""
    out = []
    for i, (loc, rot, col) in enumerate(spots):
        rx, ry, rz = (math.radians(a) for a in rot)
        paper = smat(f'{name}_{i}', col, rough=0.6)
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(rx, ry, rz))
        n = bpy.context.active_object
        n.name = name
        n.scale = (0.17, 0.085, 0.003)
        n.data.materials.append(paper)
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(rx, ry, rz))
        inset = bpy.context.active_object
        inset.name = name + '_Print'
        inset.scale = (0.11, 0.05, 0.0034)
        inset.data.materials.append(smat(f'{name}_{i}_Print', tuple(min(1, c * 1.6 + 0.1) for c in rgba(col)[:3]),
                                         rough=0.6))
        out += [n, inset]
    return out


def ping(center, facing, cam, radii=(0.1, 0.16, 0.22), spread=80.0, tube=0.009, color='gram_cyan', strength=6.0,
         name='St_Ping'):
    """Comic 'ring ring' arcs around `center`, opening towards `facing`, drawn in the plane facing `cam`."""
    c = Vector(center)
    n = (Vector(cam) - c).normalized()
    f = Vector(facing)
    u = (f - n * f.dot(n)).normalized()
    v = n.cross(u)
    mat = glow_mat(name + '_Mat', color, strength)
    out = []
    for r in radii:
        cu = bpy.data.curves.new(name, 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = tube
        cu.bevel_resolution = 2
        cu.use_fill_caps = True
        sp = cu.splines.new('POLY')
        segs = 16
        sp.points.add(segs)
        for i in range(segs + 1):
            a = math.radians(-spread / 2 + spread * i / segs)
            p = c + (u * math.cos(a) + v * math.sin(a)) * r
            sp.points[i].co = (p.x, p.y, p.z, 1)
        cu.materials.append(mat)
        ob = bpy.data.objects.new(name, cu)
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    return out


def callout(loc, cam, tail_to=None, width=0.5, height=0.3, strength=2.2, name='St_Callout'):
    """Floating gram job card (comic notification bubble) facing the camera: cream card, cyan header, coral pin,
    two text lines and the cyan accept button; a tail points at `tail_to`."""
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    root.location = Vector(loc)
    root.rotation_euler = (Vector(cam) - Vector(loc)).to_track_quat('Z', 'Y').to_euler()
    bpy.context.view_layer.update()

    def slab(n, size, xy, z, color, k, bevel=0.0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(xy[0], xy[1], z))
        o = bpy.context.active_object
        o.name = n
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(smat(n + '_Mat', color, rough=0.35, emission=strength * k))
        if bevel:
            mod = o.modifiers.new('Bevel', 'BEVEL')
            mod.width, mod.segments = bevel, 3
        o.parent = root
        return o

    w, h = width, height
    slab(name + '_Rim', (w + 0.045, h + 0.045, 0.024), (0, 0), -0.006, 'gram_cyan', 1.1, bevel=0.045)
    slab(name + '_Card', (w, h, 0.03), (0, 0), 0, 'cream', 0.55, bevel=0.035)
    slab(name + '_Head', (w * 0.9, h * 0.22, 0.012), (0, h * 0.31), 0.016, 'gram_cyan', 1.0, bevel=0.01)
    slab(name + '_Pin', (h * 0.2, h * 0.2, 0.014), (-w * 0.33, -h * 0.02), 0.017, 'pin_coral', 1.0, bevel=0.012)
    slab(name + '_Line1', (w * 0.5, h * 0.07, 0.008), (w * 0.08, h * 0.04), 0.016, 'ink', 0.0, bevel=0.004)
    slab(name + '_Line2', (w * 0.36, h * 0.07, 0.008), (0.01, -h * 0.1), 0.016, '#9AA3AD', 0.0, bevel=0.004)
    slab(name + '_Btn', (w * 0.82, h * 0.2, 0.012), (0, -h * 0.32), 0.016, 'gram_cyan_deep', 0.9, bevel=0.012)
    if tail_to is not None:
        inv = root.matrix_world.inverted()
        t = inv @ Vector(tail_to)
        d = Vector((t.x, t.y, 0)).normalized()
        base = Vector((d.x * w * 0.3, d.y * h * 0.38, 0))
        side = Vector((-d.y, d.x, 0)) * 0.05
        tip = base + d * min(0.16, max(0.06, (Vector((t.x, t.y, 0)) - base).length * 0.4))
        me = bpy.data.meshes.new(name + '_Tail')
        me.from_pydata([tuple(base + side), tuple(base - side), tuple(tip)], [], [(0, 1, 2)])
        me.materials.append(smat(name + '_TailMat', 'cream', rough=0.35, emission=strength * 0.55))
        tail = bpy.data.objects.new(name + '_Tail', me)
        bpy.context.scene.collection.objects.link(tail)
        sol = tail.modifiers.new('Solid', 'SOLIDIFY')
        sol.thickness = 0.03
        sol.offset = 0.0
        tail.parent = root
    return root
