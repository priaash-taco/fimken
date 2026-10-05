# Goku hero-character texture brief

User brief, 2026-10-04:

> Stylized premium anime game character.
> Matte orange woven gi fabric.
> Slight cloth variation and folds.
> Dark blue cotton undershirt.
> Stylized skin with subtle warm tone variation.
> Hair nearly black with blue specular highlights.
> Hand-painted anime shading rather than photorealistic skin.
> Clean high-frequency detail.
> No dirt.
> 8K hero-character texture.

## Authorized generation

The user approved the paid OpenAI image-generation CLI fallback and a total
US$10 spending cap, including retries. See budget.json for request status.
The user has now configured OPENAI_API_KEY in the ignored .env.local file.
Do not place a key in prompts, generated assets, browser code, logs or chat.

Use the bundled imagegen/scripts/image_gen.py, not a custom SDK runner.
The current prepared jobs use its documented default gpt-image-2, high quality,
2048 × 2048 PNG, one result per material. Check current estimated costs before
execution; run sequentially and reserve any uncertain request cost against the
remaining cap. The unmodified bundled CLI uses the SDK default of two retries.
Reserve all three possible attempts before each invocation; no manual retries
are authorized outside the remaining cap. Do not claim the CLI exposes billing
usage: estimated output cost and billing-confirmed spend are different fields.

## Texture scope

These first four generation jobs create material source artwork, not character
portraits or complete UV paint. Do not put a generated character image on a plane.
Cloth weave and small tonal variation may tile. Large folds, face anatomy, seams
and hair-lock highlights must be placed in the actual mesh's UV layout.
Normal/roughness maps must be derived or baked and inspected; generated colour
images are not automatically physically correct normal or roughness maps.

An 8192 × 8192 atlas is the requested delivery target. The selected generation
workflow cannot generate that natively. Record actual source dimensions and any
resampling. An 8K canvas or enlarged texture is not 8K of independently generated
detail. Do not ship an 8K atlas until UV coverage, seams, mipmaps and runtime GPU
memory have been checked. The local study currently needs UV work before final
character-specific texture painting.

## Acceptance

Inspect each material without bloom, then on the rotating rigged mesh from front,
three-quarter and rear views, including shoulder and elbow deformation. Keep
orange warm, navy distinct from skin shadows, and dark hair readable without
making the surface glossy plastic. No dirt, damage or photorealistic pores.
Do not replace the live actor until character art and motion are satisfactory.
