"""Pipeline smoke test: builds a tiny stand-in vehicle, exports a GLB and renders a preview."""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, wheel, empty, set_parent
from lib.export import export_glb
from lib.preview import render_preview

ctx = start()
paint = mat('Paint', 'taxi_pink', roughness=0.35)
glass = mat('Glass', 'glass', roughness=0.1)
tire = mat('Tire', 'tire', roughness=0.8)
hub = mat('Chrome', 'chrome', roughness=0.25, metallic=0.8)

root = empty('smoke_root')
body = box('body', (1.7, 4.4, 0.7), (0, 0, 0.65), paint, bevel=0.12, segments=3)
cabin = box('cabin', (1.5, 2.2, 0.55), (0, 0.2, 1.25), glass, bevel=0.1, segments=3)
# facing -Y: the model's LEFT is +X, FRONT is -Y
for name, x, y in (('wheel_FL', 0.78, -1.35), ('wheel_FR', -0.78, -1.35), ('wheel_RL', 0.78, 1.35), ('wheel_RR', -0.78, 1.35)):
    w = wheel(name, 0.32, 0.22, (x, y, 0.32), tire, hub)
    set_parent(w, root)
set_parent(body, root)
set_parent(cabin, root)
export_glb(ctx, '_smoke_test', [root], max_tris=4000)
render_preview(ctx, '_smoke_test')
print('[smoke] OK')
