#!/usr/bin/env bash
# Renders every story final (1600x900 WEBP + thumbs) one after another. Long-running: start it detached, e.g.
#   nohup bash blender/story/render-all.sh > blender/logs/story-finals.log 2>&1 &
cd "$(dirname "$0")/../.."
for s in story_first_call story_title story_arrival story_rain story_haze story_garage; do
  echo "=== $s start $(date +%H:%M:%S)"
  node blender/run-blender.mjs "blender/story/$s.py" 2>&1 | grep -E "Error|Traceback|\[render\]|run-blender" | tail -4
done
echo "ALL DONE $(date +%H:%M:%S)"
