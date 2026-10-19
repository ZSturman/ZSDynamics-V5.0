"""Blender-only detailed scene audit. Reads sources and writes separate JSON reports."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import os

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--inputs', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
for filename in json.loads(Path(args.inputs).read_text()):
    source = Path(filename).resolve()
    print('AUDIT_START', source, flush=True)
    try:
        load_warnings = []
        try:
            bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
        except RuntimeError as exc:
            # Some old scenes load but report shape-key repairs as an operator
            # error. Audit their in-memory state, retain the warning, never save.
            if Path(bpy.data.filepath).resolve() != source:
                raise
            load_warnings.append(str(exc))
        scene = bpy.context.scene
        objects = []
        for obj in scene.objects:
            corners = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
            bounds = [[min(p[i] for p in corners) for i in range(3)],
                      [max(p[i] for p in corners) for i in range(3)]]
            anim = obj.animation_data
            nla = []
            if anim:
                for track in anim.nla_tracks:
                    nla.append({'name': track.name, 'mute': track.mute,
                                'strips': [{'name': s.name, 'action': s.action.name if s.action else None,
                                            'frames': [s.frame_start, s.frame_end],
                                            'action_frames': [s.action_frame_start, s.action_frame_end]}
                                           for s in track.strips]})
            record = {'name': obj.name, 'type': obj.type, 'parent': obj.parent.name if obj.parent else None,
                      'collections': [c.name for c in obj.users_collection],
                      'visible': obj.visible_get(), 'hide_render': obj.hide_render,
                      'hide_viewport': obj.hide_viewport, 'selected': obj.select_get(),
                      'bounds': bounds, 'dimensions': list(obj.dimensions),
                      'location': list(obj.location), 'scale': list(obj.scale),
                      'matrix_world': [list(row) for row in obj.matrix_world],
                      'action': anim.action.name if anim and anim.action else None, 'nla': nla,
                      'modifiers': [{'name': m.name, 'type': m.type,
                                     'target': getattr(m, 'object', None).name if getattr(m, 'object', None) else None,
                                     'viewport': m.show_viewport, 'render': m.show_render}
                                    for m in obj.modifiers]}
            if obj.type == 'MESH':
                record.update(mesh=obj.data.name, vertices=len(obj.data.vertices),
                              faces=len(obj.data.polygons),
                              triangles=sum(len(p.vertices)-2 for p in obj.data.polygons),
                              materials=[m.name if m else None for m in obj.data.materials])
            if obj.type == 'ARMATURE':
                record['bones'] = len(obj.data.bones)
            objects.append(record)
        actions = []
        for action in bpy.data.actions:
            slots = [{'identifier': s.identifier, 'target_id_type': s.target_id_type} for s in action.slots]
            actions.append({'name': action.name, 'frames': list(action.frame_range), 'slots': slots,
                            'users': action.users})
        report = {'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'load_warnings': load_warnings,
                  'scene': scene.name, 'frames': [scene.frame_start, scene.frame_end],
                  'current_frame': scene.frame_current, 'fps': scene.render.fps / scene.render.fps_base,
                  'active_object': bpy.context.view_layer.objects.active.name if bpy.context.view_layer.objects.active else None,
                  'objects': objects, 'actions': actions,
                  'collections': [{'name': c.name, 'hide_render': c.hide_render, 'hide_viewport': c.hide_viewport,
                                   'objects': [o.name for o in c.objects], 'children': [v.name for v in c.children]}
                                  for c in bpy.data.collections],
                  'images': [{'name': im.name, 'filepath': im.filepath, 'packed': bool(im.packed_file)} for im in bpy.data.images],
                  'camera': scene.camera.name if scene.camera else None}
        destination = output / (report['source_sha256'][:20] + '.json')
        destination.write_text(json.dumps(report, indent=2) + '\n')
        print('AUDIT_OK', source.name, len(objects), 'objects', flush=True)
    except Exception as exc:
        print('AUDIT_ERROR', source, repr(exc), flush=True)
