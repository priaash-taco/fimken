# User-supplied character integration

Source: public/characters/Meshy_AI_super_saiyan_goku_mod_1004173344_image-to-3d-texture.glb
Source SHA256: bab7777661ee1562d15e2b056debe664e5422d37d7ca3549efcb17b2be01da8a
The user explicitly selected this model as-is. Earlier concept images are not
an approval gate and must not be substituted for this model.

Original: 776,832 triangles, 414,276 exported vertices, no skeleton/animations;
4096px colour, 2048px metallic/roughness and 4096px normal maps.
Runtime: 179,999 triangles, 21 bones, normalized maximum four weights per vertex.
Source positions were normalized and the surface decimated; no replacement
character geometry was constructed. Texture maps, UVs and proportions retained.
Six isolated unweighted vertices were repaired by nearby surface weight transfer.
Spatial skin-weight blending corrected visible separation at clothing seams.

Reproducible local processing: inspect_meshy.py -> rig_meshy.py ->
refine_meshy_weights.py (all in art/hero, using the project Blender executable).
Final editable file: rigged-refined.blend. Export: rigged.glb.
Import command: node scripts/import-character.mjs --input art/hero/meshy-manual/rigged.glb --manifest art/hero/meshy-manual/manifest.json

Runtime uses the explicit bone map plus local Quaternius motion retargeting.
The page starts at the model's rest pose with neutral lighting, no aura, bloom,
grading or screen distortion. Resume animation is an explicit settings action.
The sample avatar is not requested by the default page.

Limits: no facial blendshapes or finger joints; skinning and generic motion are
an initial usable rig, not a production combat/cloth animation solution. The
shoulder and knee diagnostic renders were reviewed after seam correction.

## Finger bones (5 October 2026)

rig_fingers.py starts from rigged-refined.blend and adds 30 finger bones (3 per finger and
thumb, both hands): rigged-fingers.blend / rigged-fingers.glb, report in finger-report.json,
close-ups fingers-open.png and fingers-fist.png. The source mesh has the four fingers fused
along their sides, so they are split by position into four bands whose weights blend into
each other and curl together; the thumb is separate. Finger weights are spatially smoothed.
Result: the hand can close into a fist; individual fingers cannot be posed apart.
Import: node scripts/import-character.mjs --input art/hero/meshy-manual/rigged-fingers.glb --manifest art/hero/meshy-manual/manifest.json
