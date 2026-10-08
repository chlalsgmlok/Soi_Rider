"""GLB export + reporting. One call per output model."""
import os
import bpy
from .shapes import tri_count


def _collect(roots):
    out = []

    def walk(o):
        out.append(o)
        for c in o.children:
            walk(c)
    for r in roots:
        walk(r)
    return out


def export_glb(ctx, name, roots=None, max_tris=None):
    """Export `roots` (and their children) or the whole scene to public/assets/models/<name>.glb.

    Prints the triangle count; raises if it exceeds `max_tris` so budgets are enforced.
    """
    os.makedirs(ctx.models_dir, exist_ok=True)
    path = os.path.join(ctx.models_dir, name + '.glb')
    objs = _collect(roots) if roots else list(bpy.context.scene.objects)
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    tris = tri_count([o for o in objs if o.type == 'MESH'])
    if max_tris is not None and tris > max_tris:
        raise RuntimeError(f'{name}: {tris} tris exceeds budget {max_tris}')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_texcoords=True,
        export_normals=True,
    )
    size_kb = os.path.getsize(path) / 1024
    print(f'[export] {name}.glb tris={tris} size={size_kb:.1f}KB nodes={len(objs)}')
    return path
