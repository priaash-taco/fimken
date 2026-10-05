# Goku visual target

The user supplied `goku-visual-reference.png` on 2026-10-03. Ignore the text panel.
This is the visual standard for our first character, Goku, in a fully 3D world.
The user specifically expects this detailed anime appearance while he moves,
trains, powers up and tests abilities in space or a 3D training landscape.

## Appearance

- Adult Super Saiyan Goku: golden spiked hair, turquoise eyes and an angular face.
- Broad shoulders, thick neck, defined arms and convincing anatomical proportions.
- Shaped hair locks with clear silhouettes, shaded planes and fine highlights.
- Orange gi and navy undershirt, sash and wristbands; deep, directional fabric folds.
- Precise cel shading, controlled linework, warm rim lighting and fiery golden aura.
- Face and anatomy must read clearly without using bloom to conceal the model.

## Acceptance

The reference is a 2D illustration. The deliverable remains a real 3D animated
character: orbitable camera, persistent geometry, working joints, consistent face
and silhouette across angles. Do not substitute a textured image plane, poster,
static background or generated video and describe that as the requested 3D model.

Review the neutral character from front, three-quarter and profile views first.
Then inspect a close-up, a strike, power-up and energy release. Only then assess
lighting, aura and the complete 3D environment.

## Current status

Solo training behavior is implemented with Seed-san as a temporary rigged actor.
The earlier procedural Goku assets are retained on disk, but are below the target
and are not loaded. No matching Goku character art has yet been produced.
The user subsequently authorized paid texture generation only, up to US$10 total
including retries. External asset purchases remain unauthorized. See
`textures/brief.md` and `textures/budget.json` for the current generation status.

On 2026-10-04 the user explicitly clarified that the detailed rear-view Goku
illustration (`reference/goku-energy-master.png`) is a quality reference for the
moving 3D character, not a substitute scene. The illustrated experiment has been
removed from the active app, including its selector and saved-mode restoration.

Inspection of `build_goku.py` confirms that the old 1024-pixel textures contain
generated colour modulation/grain. They do not contain painted anatomical,
hair-lock or garment-fold detail. Increasing their resolution would preserve
that limitation. A replacement needs convincing geometry, usable UVs and
authored surface detail before further lighting/effect work is evaluated.

## Isolated study and latest material direction

`build_goku_study.py` produces a separate skinned asset under
`public/studies/goku-v2/`, plus a saved Blender scene. The live app does not load it.
`render_goku_study.py` renders that saved scene independently for inspection.
Front, three-quarter, rear and face views were rendered successfully. This study
has not passed the reference standard: the shoulder/collar transitions, large
hair shapes, garment folds and material detail still need work. The generated
material textures now exist under `output/imagegen/` (four native 2048-square
images generated with the approved OpenAI API fallback). They improve surface
detail but do not resolve the study's shape or UV problems.

Latest texture brief supersedes the gold-hair palette for this pass: nearly black
hair with blue highlights, matte orange woven gi, navy cotton undershirt, warm
stylized skin, clean hand-painted anime treatment and no dirt. It requests an
8K hero-character texture deliverable; native source size must remain explicit.

`apply_generated_textures.py` applies the sources to a sibling skinned model in
`public/studies/goku-textured-v1/`. Its embedded source dimensions, skeleton and
11 animation clips were verified. Front, three-quarter and rear neutral-light
renders are in `art/previews/goku-textured-v1/`. This remains an unaccepted
material study: disconnected shoulder shapes, blocky folds, facial structure and
hair-lock UV direction need character-authoring work. It is not the live actor.
