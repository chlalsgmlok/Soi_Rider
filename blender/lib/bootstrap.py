"""Common entry for every asset script.

Usage at the top of an asset script:
    import sys, os; sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from lib.bootstrap import start
    ctx = start()   # parses `-- --log <path> --root <dir>`, redirects prints to the log, clears the scene

`ctx.root` is the game project root (apps/soi-rider). `ctx.flags` holds extra CLI words (e.g. "--no-preview").
The Microsoft Store Blender launcher does NOT forward stdout, so everything goes to the log file that
blender/run-blender.mjs prints after the run.
"""
import os
import sys
import traceback
import bpy


class Ctx:
    def __init__(self, root, log_path, flags):
        self.root = root
        self.log_path = log_path
        self.flags = flags

    @property
    def models_dir(self):
        return os.path.join(self.root, 'public', 'assets', 'models')

    @property
    def previews_dir(self):
        return os.path.join(self.root, 'blender', 'previews')

    @property
    def story_dir(self):
        return os.path.join(self.root, 'public', 'assets', 'story')

    def want_preview(self):
        return '--no-preview' not in self.flags


def _parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    log_path, root, flags = None, None, []
    i = 0
    while i < len(argv):
        if argv[i] == '--log' and i + 1 < len(argv):
            log_path = argv[i + 1]
            i += 2
        elif argv[i] == '--root' and i + 1 < len(argv):
            root = argv[i + 1]
            i += 2
        else:
            flags.append(argv[i])
            i += 1
    if root is None:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    return log_path, root, flags


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def start():
    log_path, root, flags = _parse_args()
    if log_path:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        stream = open(log_path, 'w', encoding='utf-8', buffering=1)
        sys.stdout = stream
        sys.stderr = stream

        def _hook(exc_type, exc, tb):
            traceback.print_exception(exc_type, exc, tb, file=stream)
            stream.flush()
        sys.excepthook = _hook
    clear_scene()
    print(f'[bootstrap] blender {bpy.app.version_string} root={root} flags={flags}')
    return Ctx(root, log_path, flags)
