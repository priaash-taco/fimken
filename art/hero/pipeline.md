# Original hero asset pipeline — 2026-10-04

## Current direction
The original anime hero concept is output/imagegen/original-hero-concept.png.
Its exact prompt is art/hero/concept-prompt.txt. Generated through the authorized
OpenAI fallback CLI, native 2048 x 2048. This is modelling reference artwork,
not a texture atlas, a 3D asset, or an image to display over the live character.
The design uses dark swept hair, aubergine layered clothing, rust-orange accents,
and athletic anatomy. It deliberately does not reproduce a Dragon Ball character.

Meshy is ON HOLD at the user's request. No Meshy task was submitted, no credits
were spent, and no subscription was started. The local submission command is
disabled. The saved plan is informational only: one Meshy 6 Lite image-to-3D draft
with 2K textures, listed at 15 credits on 2026-10-04. Future generation requires
renewed user instruction. Do not enable retries or regenerate automatically.
Do not use Meshy rigging or animation services; those remain local responsibilities.

## Available environment
- Blender 4.5.9: import, inspect, adjust, rig, skin, animate and export.
- Image-generation API fallback: concept artwork and raster assets only.
- Three.js 0.186.1, three-vrm: authored GLB/VRM materials and skeletal animation.
- External test rig already acquired: Seed-san, VirtualCast, Inc., VRM Public
  License 1.0. This is a genuine externally authored binary glTF/VRM character,
  not the proposed hero and not evidence that our hero quality target is met.
- Quaternius animation library, CC0: 45 retargetable motions plus source T-pose.
- GPU: RTX 3050 Ti Laptop, 4 GB VRAM. Hunyuan3D-2's documented shape requirement
  is 6 GB, so no local image-to-3D install was attempted.

## Steps and acceptance
1. Concept: complete. Inspect face, silhouette, hands, clothing and pose.
2. External mesh: deferred. Obtain a textured mesh from an artist or specialist
   service; preserve original source files and terms. Never build the final body
   from primitive geometry. The old Goku can be used only with ?character=debug-goku.
3. Blender inspection: inspect front, profile, back and close face/hands; identify
   actual topology, disconnected clothing, texture seams, UV packing and normals.
   A generated static mesh is not yet a rigged character.
4. Local rig/weights: fit a humanoid skeleton to actual joint landmarks; bind the
   imported mesh, then test shoulder elevation, elbow bends, hip/knee flexion,
   feet and fingers. Correct weights instead of concealing problems with effects.
5. Animation: map real source clip names and retarget in rest space. Supply idle,
   anticipation, movement, power, charge, release, recover and airborne clips.
   The reference rig uses generic demonstration motions; its punch substitute
   for the kick slot is not an authored martial-arts kick.
6. GLB: export mesh, UV artwork, materials, skinning and named animations in one
   binary container. Preserve normal/roughness maps and authored toon settings.
7. Stage: use scripts/import-character.mjs and the manifest template. Structural
   checks reject unskinned meshes, missing image data, invalid bone/clip mappings
   and the known rejected procedural files. Structural validation is not visual QA.
8. Neutral review: open /?character=candidate&inspection=1. No aura, bloom, colour
   grading, vignette, atmospheric haze or coloured rim light. Orbit and inspect
   anatomy, face and silhouette. Direct rendering retains authored materials and
   renderer output tone mapping. Check animation deformation separately.
9. Promote: --promote requires complete mappings and recorded neutral-light,
   deformation and source-terms review. It updates only the asset definition;
   the character controller, audio, camera and physics do not need replacement.
10. Effects: use skeleton-following aura ribbons, rising sparks, lightning,
    controlled beam brightness, heat shimmer, small debris and energy lighting.
    These are local shaders/simulation. No online API runs in the browser.

## Commands
npm run meshy:plan — displays the deferred plan; no network call.
node scripts/import-character.mjs --input PATH.glb --manifest PATH.json --check-only
node scripts/import-character.mjs --input PATH.glb --manifest PATH.json
node scripts/import-character.mjs --input PATH.glb --manifest PATH.json --promote

The manifest template is character-manifest.example.json. Replace placeholder
source and terms, populate actual bone names and clip names. A staged rig can
be inspected before its animations are supplied; it cannot be promoted yet.
The importer preserves old definitions under art/hero/history/ and uses hashed
asset filenames to retain prior versions.

## Sources
https://docs.meshy.ai/en/api/image-to-3d
https://docs.meshy.ai/en/api/pricing
https://github.com/Tencent-Hunyuan/Hunyuan3D-2
https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san
https://vrm.dev/licenses/1.0/
https://quaternius.itch.io/universal-animation-library


## External rig material pass (2026-10-04)
The Seed-san reference now defaults to an asset-specific cinematic MToon finish.
Skin, eyes, hair, cloth and hard surfaces retain their authored texture maps;
only shading parameters, rim colours and outline widths are adjusted. Unknown
materials retain their original values. Settings > Character finish switches
between Cinematic cel shading and Original materials on the same loaded rig.
Inspect without effects removes rim and post-processing for a neutral review.
Outline width is a relative percentage of each material's configured width;
materials with disabled outlines (including eyes) stay disabled.

VRM expressions supply blinks and a restrained focused face during attacks.
Cinematic mode enables camera-directed eye gaze while playing. Camera framing,
energy intensity, aura width and charge size were adjusted to keep the face
readable. These changes do not add texture resolution, geometry detail or new
motion-capture data. Seed-san remains a temporary avatar, and the generic
retargeted motions still need a purpose-made martial-arts animation pass.
No Meshy requests or other paid generation were made for this pass.
