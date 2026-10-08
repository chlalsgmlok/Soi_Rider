"""props_infra contract nodes: place attach-point empties reliably and verify them in the exported GLB.

Pitfall in the shared lib (lib.shapes): `empty(name, loc)` followed by `set_parent(obj, root)` (or
`empty(name, loc, parent=root)`) loses the location. set_parent() copies `matrix_world`, which is still the
identity because the depsgraph has not evaluated the new `location` yet, so the empty snaps to the parent
origin and the GLB node carries no translation. anchor() updates the view layer first and asserts the result;
verify_glb_nodes() re-reads the written GLB and fails the build (exit 3) if a contract node drifted.
"""
import json
import struct
import bpy
from mathutils import Matrix, Quaternion, Vector
from .shapes import empty, set_parent


def anchor(name, loc, parent):
    """Empty `name` at world position `loc` (Blender axes), parented to `parent` with the position kept."""
    obj = empty(name, loc)
    bpy.context.view_layer.update()
    set_parent(obj, parent)
    bpy.context.view_layer.update()
    got = obj.matrix_world.translation
    if (got - Vector(loc)).length > 1e-4:
        raise RuntimeError(f'{name}: empty at {tuple(round(v, 3) for v in got)}, expected {tuple(loc)}')
    return obj


def _node_matrix(node):
    if 'matrix' in node:
        m = node['matrix']  # glTF is column-major
        return Matrix([m[0:4], m[4:8], m[8:12], m[12:16]]).transposed()
    t = Vector(node.get('translation', (0.0, 0.0, 0.0)))
    x, y, z, w = node.get('rotation', (0.0, 0.0, 0.0, 1.0))
    sx, sy, sz = node.get('scale', (1.0, 1.0, 1.0))
    return Matrix.Translation(t) @ Quaternion((w, x, y, z)).to_matrix().to_4x4() @ Matrix.Diagonal((sx, sy, sz, 1.0))


def glb_world_positions(path):
    """{node name: world translation in three.js axes} read straight from the GLB JSON chunk."""
    with open(path, 'rb') as f:
        data = f.read()
    json_len = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_len].decode('utf-8'))
    out = {}

    def walk(idx, parent_m):
        node = gltf['nodes'][idx]
        m = parent_m @ _node_matrix(node)
        out[node.get('name', str(idx))] = m.translation.copy()
        for c in node.get('children', []):
            walk(c, m)

    for root in gltf['scenes'][gltf.get('scene', 0)]['nodes']:
        walk(root, Matrix.Identity(4))
    return out


def verify_glb_nodes(path, expected, tol=0.01):
    """expected: {node name: Blender (x, y, z)}. glTF Y-up maps Blender (x, y, z) to three.js (x, z, -y)."""
    world = glb_world_positions(path)
    for name, (x, y, z) in expected.items():
        want = Vector((x, z, -y))
        got = world.get(name)
        if got is None:
            raise RuntimeError(f'{path}: node {name} missing')
        if (got - want).length > tol:
            raise RuntimeError(f'{name}: GLB world position {tuple(round(v, 3) for v in got)} '
                               f'!= expected {tuple(round(v, 3) for v in want)} (three.js axes)')
        print(f'[nodes] {name} three.js @({got.x:.2f}, {got.y:.2f}, {got.z:.2f}) ok')
