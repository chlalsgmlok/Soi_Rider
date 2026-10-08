"""Reference poses for the char_body segmented rig (Blender eulers, radians, XYZ order).

Rest rotations of every node are identity, so a pose is just "set these local rotations".
Blender X-rotation == three.js X-rotation (the glTF Y-up conversion is a rotation about X), so the
numbers below can be copied into runtime code for rotation.x; Blender Y here == three.js -Z, Blender Z == three.js Y.
Sign guide (facing -Y): torso/head +X = lean forward; thigh -X = swing forward; shin +X = bend knee;
arm -X = reach forward; thigh_L -Y = splay outward (mirror the sign for _R).
"""

# pose name -> {node: (x, y, z)}; `_L` entries are mirrored onto `_R` (y, z negated) by apply_pose
RIDER = {
    'torso': (0.22, 0.0, 0.0),
    'head': (-0.12, 0.0, 0.0),
    'thigh_L': (-1.25, -0.12, 0.0),
    'shin_L': (1.15, 0.0, 0.0),
    'foot_L': (0.10, 0.0, 0.0),
    'arm_L': (-1.0, 0.0, 0.0),
    'forearm_L': (-0.45, 0.0, 0.0),
}

PILLION = {
    'torso': (0.06, 0.0, 0.0),
    'head': (-0.04, 0.0, 0.08),
    'thigh_L': (-1.30, -0.22, 0.0),
    'shin_L': (1.25, 0.0, 0.0),
    'foot_L': (0.05, 0.0, 0.0),
    'arm_L': (-0.12, 0.12, 0.0),      # arms tucked in and down: hands rest on the knees, under a seated poncho
    'forearm_L': (-0.62, 0.0, 0.0),
}

STOOL = {
    'torso': (0.08, 0.0, 0.0),
    'thigh_L': (-1.52, -0.10, 0.0),
    'shin_L': (1.48, 0.0, 0.0),
    'arm_L': (-0.55, 0.0, 0.0),
    'forearm_L': (-0.95, 0.0, 0.0),
}

WAVE = {
    'arm_R': (0.0, 0.0, 0.0),
    'arm_L': (-0.25, -1.9, 0.0),
    'forearm_L': (-0.2, -0.7, 0.0),
    'hand_L': (0.0, 0.0, 0.3),
}


def apply_pose(nodes, pose, mirror=True):
    """nodes: {base name: object}. Mirrors every *_L entry to *_R unless _R is given explicitly."""
    full = dict(pose)
    if mirror:
        for k, (x, y, z) in pose.items():
            if k.endswith('_L'):
                full.setdefault(k[:-2] + '_R', (x, -y, -z))
    for k, rot in full.items():
        o = nodes.get(k)
        if o is None:
            continue
        o.rotation_mode = 'XYZ'
        o.rotation_euler = rot
    return nodes
