"""Outfit sleeve shells for char_body (outfit_hood, outfit_jacket) + thin open strips for stripes/zips.

Runtime contract (see blender/assets/characters/README.md):
  sleeve_upper_L / sleeve_upper_R : origin = shoulder joint (same as arm_L / arm_R)     -> re-parent to arm_<side>
  sleeve_lower_L / sleeve_lower_R : origin = elbow joint    (same as forearm_L / _R)    -> re-parent to forearm_<side>
They ship as direct children of the outfit root. Their local transforms (relative to the outfit root, i.e. the
`torso` joint) equal the arm / forearm transforms relative to `torso`, so the outfit fits the A-pose before the
re-parent, and after `joint.add(sleeve); sleeve.position.set(0, 0, 0)` they follow every arm pose.
Both ends of each shell are domes centred on the joint they hinge about, so bending never opens a gap.
"""
import math
import bpy
from mathutils import Matrix, Vector
from lib import characters_rig as R
from lib.characters_geo import loft, make_obj, transform, to_pivot

SLEEVE_PARENT = {'sleeve_upper_L': 'arm_L', 'sleeve_upper_R': 'arm_R',
                 'sleeve_lower_L': 'forearm_L', 'sleeve_lower_R': 'forearm_R'}


def dome(radius, ry=None, lats=(90, 50, 20, 0), z0=0.0, sign=1.0):
    """Hemisphere rings (z, rx, ry) centred on z0; sign=+1 opens downwards (cap on top), -1 cap at the bottom."""
    ry = radius if ry is None else ry
    out = []
    for la in lats:
        a = math.radians(la)
        out.append((z0 + sign * radius * math.sin(a), radius * math.cos(a), ry * math.cos(a)))
    out[0] = (out[0][0], 0, 0) if lats[0] == 90 else out[0]
    return out


def _axis_frame(side):
    """Limb space (built along -Z from the joint) -> body space rotation for the neutral A-pose."""
    return Matrix.Rotation(-side * R.A_POSE, 4, 'Y')


def shell(name, rings, mats, band_mats, joint, side, segs=8):
    """Loft a sleeve along -Z (rings top -> bottom), flip to outward faces, A-pose it and put its origin on `joint`."""
    obj = loft(name, rings, segs, mats, band_mats=band_mats)
    obj.data.flip_normals()
    transform(obj, Matrix.Translation(joint) @ _axis_frame(side))
    return to_pivot(obj, joint)


def facet_point(rx, ry, theta_deg, segs, lift=0.0):
    """2D point ON a loft ring polygon (not the ideal ellipse) along loft angle theta (0 = front -Y, 90 = +X),
    pushed `lift` along the facet normal; returns (point, normal). Exact ray/edge hit, so details never float
    over (or sink into) the flat facets."""
    th = math.radians(theta_deg) % (2 * math.pi)
    step = 2 * math.pi / segs
    k = int(th // step)
    a0, a1 = k * step, (k + 1) * step
    p0 = Vector((rx * math.sin(a0), -ry * math.cos(a0)))
    e = Vector((rx * math.sin(a1), -ry * math.cos(a1))) - p0
    d = Vector((math.sin(th), -math.cos(th)))
    t = (p0.x * e.y - p0.y * e.x) / (d.x * e.y - d.y * e.x)
    n2 = Vector((e.y, -e.x)).normalized()
    if n2.dot(d) < 0:
        n2 = -n2
    return d * t + n2 * lift, n2


def limb_point(joint, side, ring, theta_deg, segs=8, lift=0.0):
    """Point on the faceted sleeve surface of `ring` = (z, rx, ry) in body space, plus the facet normal.
    Use theta = side * (90 - a) for `a` degrees in front of the outer side of the limb."""
    q, n2 = facet_point(ring[1], ring[2], theta_deg, segs, lift)
    m = _axis_frame(side).to_3x3()
    return Vector(joint) + m @ Vector((q.x, q.y, ring[0])), (m @ Vector((n2.x, n2.y, 0.0))).normalized()


def strip(name, pts, normals, width, thick, mat, lift=0.0):
    """Thin raised stripe lying on a surface: top + two side walls only (the underside is buried), 6 tris/segment."""
    pts = [Vector(p) for p in pts]
    verts, faces = [], []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = Vector(normals[i]).normalized()
        n = (n - t * n.dot(t)).normalized()
        s = t.cross(n).normalized() * (width * 0.5)
        lo, hi = n * lift, n * (lift + thick)
        verts += [p + lo - s, p + hi - s, p + hi + s, p + lo + s]
    for i in range(len(pts) - 1):
        a, b = 4 * i, 4 * (i + 1)
        n = Vector(normals[i]).normalized()
        s = (pts[i + 1] - pts[i]).cross(n)
        for quad, want in (((a, b, b + 1, a + 1), -s), ((a + 1, b + 1, b + 2, a + 2), n), ((a + 2, b + 2, b + 3, a + 3), s)):
            v0, v1, v2 = verts[quad[0]], verts[quad[1]], verts[quad[2]]
            if (v1 - v0).cross(v2 - v1).dot(want) < 0:
                quad = tuple(reversed(quad))
            faces.append(quad)
    return make_obj(name, verts, faces, [mat], smooth_angle=30)


def attach_to_root(obj, root, torso=R.TORSO):
    """Child of the outfit root (root sits at the origin with mesh data relative to `torso`): local = joint - torso."""
    joint = obj.location.copy()
    obj.parent = root
    obj.matrix_parent_inverse.identity()
    obj.location = joint - Vector(torso)
    bpy.context.view_layer.update()
    return obj


def reparent_sleeves(nodes, outfit_root):
    """Preview helper doing exactly what the runtime does: move each sleeve onto its body joint, zero offset."""
    moved = []
    for child in list(outfit_root.children):
        base = child.name.split('.')[0]
        joint = nodes.get(SLEEVE_PARENT.get(base, ''))
        if joint is None:
            continue
        child.parent = joint
        child.matrix_parent_inverse.identity()
        child.location = (0, 0, 0)
        child.rotation_mode = 'XYZ'
        child.rotation_euler = (0, 0, 0)
        child.scale = (1, 1, 1)
        moved.append(child)
    bpy.context.view_layer.update()
    return moved
