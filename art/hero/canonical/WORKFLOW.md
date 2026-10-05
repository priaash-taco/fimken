# Canonical hero handoff

The approved design is hero.png, pinned by SHA-256 in reference.json.
Do not redesign, generate alternate artwork, build a procedural substitute or
promote the test avatar as this character. The previous concept is superseded.

## Current state
Preparation complete; generation blocked by missing MESHY_API_KEY in the local
project .env.local. No Meshy submission or subscription purchase was made.
The user requested one highest-quality sensible image-to-3D model followed by
local rigging and runtime integration. Do not buy a subscription or regenerate
models automatically. The earlier $2 image allowance is unrelated to Meshy.

## Prepared generation
Meshy 7.1, Ultra 4K geometry, 4K PBR textures, approximately 100,000 triangles,
preserve pre-remesh source, A-pose for rigging, image enhancement disabled.
Both geometry and texture use the exact canonical PNG. Current published price
is 35 Meshy API credits. Full parameters: ../meshy-hero-plan.json.

From C:/HyYas/fimken-studio:
- node scripts/meshy-hero.mjs check (local validation, no network)
- node scripts/meshy-hero.mjs plan (read-only plan)
- node scripts/meshy-hero.mjs submit (one paid request only)
- node scripts/meshy-hero.mjs status (resume saved task, no regeneration)
- node scripts/meshy-hero.mjs download (save source and detailed GLB)

An exclusive .meshy/canonical-hero.json reservation prevents duplicate paid
requests even after timeout. If submission is uncertain, reconcile provider
history; never delete the reservation to retry. No credentials or signed
asset URLs should be placed in the public app.

## After download
1. Inspect source.glb and detailed-source.glb in Blender. Compare silhouette,
   hair, face, muscular proportions, outfit, sash, forearm armor and boots with
   the canonical reference. Inspect inferred sides/back; one reference cannot
   establish their exact design. Record visible mismatches before changing art.
2. Rig the actual imported geometry locally. Locate joints from the actual
   model; fit the armature, skin, and inspect shoulder, elbow, wrist, hip and knee
   deformation. Give hair/armor appropriate rigid weighting and sash proper
   motion. Do not substitute primitive geometry or assume generic weights are
   production-ready.
3. Export an embedded textured skinned GLB, inspect its real bone and clip names,
   populate the character manifest with those mappings and verified source
   terms, and stage via scripts/import-character.mjs. Keep authored materials.
4. Open /?character=candidate&inspection=1 for the FIRST runtime review. Disable
   aura, bloom, grade, heat distortion, atmospheric overlays and coloured rim.
   Capture full body and face plus side/back views. Report asset quality honestly.
5. Review deformation and add/retarget local animations. Promotion requires
   recorded neutral, source-terms and deformation checks. No automatic paid
   rigging, animation or regeneration calls are included in this workflow.

Sources checked 2026-10-04:
https://docs.meshy.ai/en/api/image-to-3d
https://docs.meshy.ai/en/api/pricing
