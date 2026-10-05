# First material pass — 2026-10-04

Generated via the unmodified bundled imagegen CLI, using gpt-image-2, high
quality, one native 2048 × 2048 PNG per material. All four requests succeeded.
The prompts are orange-gi.txt, navy-cotton.txt, warm-skin.txt and ink-hair.txt in
this directory. The exact source brief is brief.md.

Outputs are in ../../output/imagegen/:
- orange-gi-source.png
- navy-cotton-source.png
- warm-skin-source.png
- ink-hair-source.png
- material-preview.jpg (downscaled contact sheet)
- texture-manifest.json (source dimensions, hashes and prompt locations)

Official image calculator: https://developers.openai.com/api/docs/guides/image-generation#calculating-costs
Checked gpt-image-2 / high / 2048 × 2048: 14,272 output tokens, $0.42816 per image.
Four successful outputs estimate $1.71264, plus prompt input. Exact billed usage
is not exposed by the bundled CLI. $6 remains conservatively reserved across
four invocations, including up to two SDK retries each; total authorized cap $10.
No manual retries or additional generations were submitted.

The sources are embedded in the sibling model:
../../public/studies/goku-textured-v1/goku-textured-study.glb
Verified four 2048-square material images, one skeleton and 11 animation clips.
Three neutral-light renders and export verification are in
../previews/goku-textured-v1/. Preview uses the exported PBR materials with AgX
display mapping; the live web renderer's appearance may differ.

Visual review: cloth sources have fine weave, skin has subtle warm painted
variation, and hair has dark blue directional strokes. Existing geometry and UVs
still limit the character: shoulders do not join convincingly, folds are blocky,
the face needs reshaping and hair direction needs per-lock UVs. The live app is
unchanged. Material-source generation is complete; final character UV painting
and the requested 8K delivery remain outstanding. No source was upscaled.
