#!/bin/sh
# Copies the working tree's source into a stable snapshot dir so other editors' HMR reloads cannot disturb long QA runs.
SNAP="$1"; SRC="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$SNAP"
cp -r "$SRC/src" "$SNAP/" && cp "$SRC/index.html" "$SRC/vite.config.js" "$SRC/package.json" "$SNAP/"
sed -i "s#import('./mocap/clips.json', { with: { type: 'json' } })#import('./mocap/clips.json')#" "$SNAP/src/engine/mocap-moves.js"  # vite dev cannot serve dynamic JSON with an import attribute
