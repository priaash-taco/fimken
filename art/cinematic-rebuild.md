# Fimken cinematic rebuild — first scene

## Diagnosis before implementation

The previous GLB was a code-authored approximation of a character. More polygons
did not improve its facial anatomy, hair design, garment construction or texture
art. The runtime discarded imported material properties for one generic toon
material. The camera oscillated continuously while a repeating action list
advanced faster with volume. The procedural rocks amplified the prototype look.
Output resolution was not the main defect.

Retained: Three.js/WebGL 2, Web Audio capture and cancellation, local-file playback,
the minimal settings UI, fixed-step movement/recoil physics, tests and reduced
motion support. Replaced in the active entry point: character source, character
loader, animation control, camera control, environment, effects and render chain.
Old procedural files remain on disk for recovery but are not imported by main.js.

## The first scene

One authored character (Seed-san), one abstract dark environment (Obsidian), one
original 20-second score (First Light). The score starts only after a click in
settings. The preview sequence holds an opening composition, approaches during
the build, cuts at the eight-second power event, changes to gesture/strike shots,
then follows a short launch, hover and landing. It repeats silently in ambient
mode. External audio instead drives phrase-level choices and restrained onsets.

Seed-san is a **temporary pipeline actor**, not Goku and not an assertion that the
reference-image quality target has been met. The authored model contains 45,058
triangles, 15 embedded images, five skinned meshes, a humanoid rig, MToon/PBR
materials, expression morphs, constraints and spring bones. It is loaded as VRM
1.0, a binary glTF container with humanoid/material extensions. No character
geometry is created in runtime code.

## Runtime responsibilities

- `AudioEngine`: authorized PC/microphone capture, local playback and cleanup.
- `AudioAnalyzer`: sample-rate-aware bass/mid/high bands and positive spectral flux.
- `MusicState`: smoothed energy, rolling intensity, transient strength, conservative
  onset-based tempo/confidence and section changes. BPM is an estimate, not a
  full-song beat grid; confidence disappears during silence.
- `CharacterController`: load/validate authored skinned assets, retain textures and
  shaders, normalize scale, attach animation and expression layers.
- `AnimationDirector`: play imported clips with fades, resolve one-shot actions,
  maintain body animation alongside independent facial expressions.
- `SceneDirector`: the authored 20-second sequence, manual actions and live musical
  direction at four-bar boundaries (timed holds when tempo is uncertain).
- `CinematicDirector`: named shot compositions, bounded dolly movement, deliberate
  cuts, close study framing and manual camera handoff.
- `EnvironmentDirector`: HDR lighting input, shadow-receiving floor, atmospheric
  haze and background particles. The only current environment is Obsidian, with
  two lighting palettes; the UI does not claim a city or mountain arena exists.
- `LightingDirector`: key/fill/rim, shadow settings and limited energy illumination.
- `VFXDirector`: bounded aura ribbons, sparks, shockwave, hand light, energy beam
  and flight trail. No procedural rock models.
- `CinematicRenderer`: HDR render targets, ACES tone mapping, bloom with a high
  threshold, restrained grading, output conversion and FXAA. Quality controls
  resolution, shadow maps, particle budgets, bloom and texture anisotropy.

The retained physics is a bounded spring/impulse simulation at 120 Hz, not a
general-purpose cloth, ragdoll, collision-mesh or destruction engine.

## Replacing the actor

Edit `src/engine/assets.js` with the asset URL, target height, facing and semantic
clip map. For a self-contained rigged GLB with its own clips, use `format: 'gltf'`
and omit `animations` and `animationRig`. Native authored materials are preserved.
For another VRM humanoid, the same Quaternius library can be retargeted by keeping
those fields. A different external rig requires its own retarget adapter; arbitrary
rigs are not assumed interchangeable. Check skin weights, feet, hands, face and
animation framing in the character-study view before accepting any replacement.

To reach the Goku reference we still need: a well-authored Goku asset with accurate
face/hair/gi textures, suitable expressions, and anime-specific power-up, fight,
flight and recovery clips. The imported clips demonstrate the pipeline but were
not authored for Dragon Ball. Raising texture dimensions or polygon counts will
not replace that production work. Do not expand to more worlds before that art
and motion quality are accepted.

## Performance and limitations

High allows a native 3840 × 2160 frame. Balanced caps the pixel budget at 1440p;
Performance caps it at 1080p and disables bloom. A three-second frame-time window
reduces render scale toward 65% under sustained load and restores it cautiously.
Geometry and texture source quality are retained. Native 4K allocation is tested;
4K/60 fps and 1440p/60 fps on a reference desktop GPU are **not benchmarked**.

This is a real-time 3D scene, not AI-generated video and not a paid API integration.
The current rigged test actor and motion library establish the replacement path;
they do not complete the final Goku artwork requirement.

## Asset provenance

- Seed-san © VirtualCast, Inc. Official source:
  https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san
  VRM Public License 1.0: https://vrm.dev/licenses/1.0/
  Embedded metadata permits redistribution and modification and requires credit;
  the UI and this document retain it. The downloaded VRM is unmodified.
- Universal Animation Library Standard by Quaternius, CC0:
  https://quaternius.itch.io/universal-animation-library
  Downloaded free glTF mirror:
  https://github.com/J-Ponzo/gltf-universal-animation-library
  License and source notice are in `art/licenses/`.
- Studio Small 09 by Sergej Majboroda, Poly Haven, CC0:
  https://polyhaven.com/a/studio_small_09
- First Light: original synthesized PCM score, generated by `art/build_score.mjs`.
  No third-party audio samples or paid assets were used.
