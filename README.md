# Fimken — real-time anime visualizer

For the current implementation and continuation notes, read [CLAUDE_HANDOVER.md](CLAUDE_HANDOVER.md).

Working copy: C:/HyYas/fimken-studio. The original OneDrive directory remains a
backup because the desktop app held that folder open during migration.

The default scene now uses the user's supplied Meshy GLB, processed locally to
179,999 triangles with its original 4K colour/normal maps and a 21-bone skeleton.
The normal page opens in automatic cinematic training. Use `/?inspection=1`
for neutral light with aura and post-processing disabled.
Seed-san is no longer the default or linked from the page.

The original source file is preserved under public/characters/. Processing,
editable Blender rig and deformation previews are in art/hero/meshy-manual/.
No additional Meshy requests were made. The user's supplied model is the active
character; earlier concept artwork is retained only as historical work.

## Run
npm install
npm run dev
npm run build

Use settings beside the wordmark. First Light plays the local 20-second score.
PC audio, microphone, local files and silent demo remain available. Audio stays
on device and capture starts only from a user gesture. Space pauses, F toggles
fullscreen, S opens settings. Drag the canvas to orbit; scroll to zoom.

## Character workflow
src/engine/hero-asset.json is the swappable production/candidate definition.
scripts/import-character.mjs stages validated external GLBs with source/terms,
embedded artwork, skeletons, bone mappings and named animation clips. Explicit
promotion requires completed neutral-light and deformation review. The active character preserves its authored PBR materials. Generic Quaternius
motions are retargeted in rest space onto its explicit humanoid bone mapping.
The rig has no facial blendshapes or individual finger articulation yet.
Combat motion and cloth deformation remain draft-quality.

Settings > Inspect without effects disables aura, bloom, grading, vignette and
cinematic rim lighting. The renderer draws directly under neutral light. Imported PBR materials are retained for this first review. Character study frames the face.

Effects use body-joint emitters, turbulent ribbons, sparks, lightning, controlled
energy beam brightness, subtle screen-space heat shimmer and small debris.
The 120 Hz spring/impulse physics remains for flight and recoil; it is not cloth,
ragdoll or destruction simulation. All runtime effects and audio analysis are local.

High quality allows up to a 3840 x 2160 render target with adaptive resolution.
This is not a promise of native 4K source textures or sustained 4K/60 fps.

## Credits
Seed-san: VirtualCast, Inc., VRM Public License 1.0 (art/licenses/seed-source.md).
Animation library: Quaternius, CC0 (art/licenses/animations-source.md).
Studio Small 09: Sergej Majboroda / Poly Haven, CC0.
First Light: original synthesized score. Original hero concept: OpenAI image API.

## Validation
npm test
npm run test:browser

The tests distinguish the active external rig from archived procedural debug
assets, inspect GLB structure and promotion rules, exercise material review,
audio capture cancellation, choreography, physics, mobile layout and 4K allocation.
Browser screenshots are saved in ignored test-results/.
