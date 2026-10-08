"""props_infra preview wrapper: the standard preview plus optional extra QA angles.

The contract preview goes to blender/previews/<name>.png (lib.preview.render_preview).
With the CLI flag `--angles`, extra views render to shots/props_infra/<name>_<i>.png (gitignored) for critique.
"""
import os
import bpy
from mathutils import Vector
from lib.preview import render_preview


class _ShotsCtx:
    def __init__(self, ctx):
        self._ctx = ctx
        self.previews_dir = os.path.join(ctx.root, 'shots', 'props_infra')

    def want_preview(self):
        return self._ctx.want_preview()


def _pad_helper(pad):
    """Invisible 2-vertex mesh that scales the framing bounds by `pad` (tall props get cropped otherwise)."""
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c, h = (lo + hi) / 2, (hi - lo) / 2 * pad
    return _box_helper(c - h, c + h)


def _box_helper(lo, hi):
    me = bpy.data.meshes.new('_frame')
    me.from_pydata([tuple(lo), tuple(hi)], [], [])
    obj = bpy.data.objects.new('_frame', me)
    obj.hide_render = True
    bpy.context.scene.collection.objects.link(obj)
    return obj


def previews(ctx, name, view=(1.0, -1.35, 0.85), extra_views=(), res=(720, 540), pad=1.0):
    """extra_views items: a view vector, or (view, (lo_xyz, hi_xyz)) to frame only that region (detail QA)."""
    if not ctx.want_preview():
        return
    helper = _pad_helper(pad) if pad != 1.0 else None
    render_preview(ctx, name, view=view, res=res)
    if helper is not None:
        bpy.data.objects.remove(helper, do_unlink=True)
    if '--angles' not in ctx.flags:
        return
    shim = _ShotsCtx(ctx)
    for i, item in enumerate(extra_views):
        if len(item) == 2 and len(item[1]) == 2:
            v, (lo, hi) = item
            focus = _box_helper(Vector(lo), Vector(hi))
            render_preview(shim, f'{name}_{i}', objs=[focus], view=v, res=(560, 560))
            bpy.data.objects.remove(focus, do_unlink=True)
        else:
            render_preview(shim, f'{name}_{i}', view=item, res=(560, 560))
