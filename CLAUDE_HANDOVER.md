# Fimken — handover to Claude

Prepared 4 October 2026. This file summarizes implemented work and user decisions. Read the current source before making changes; some older README/artwork notes describe superseded approaches.

## Open the correct project

- Active working directory: `C:/HyYas/fimken-studio`
- Local preview: `http://127.0.0.1:5173/`
- Windows / PowerShell, JavaScript ES modules, Vite, Three.js, three-vrm, Playwright (Edge).
- The old `C:/Users/priaa/OneDrive/Documents/ChatGPT/fimken` folder is a backup/stale chat cwd. Do not develop there.
- Much of the project is currently untracked in Git. Do not reset, clean, or discard untracked files. Preserve existing assets and local work.
- No code changes are pending from the handover request itself. Ask the user which refinement to tackle next; do not restart the project.

## What the user is building

A polished, music-reactive anime hero showcase called Fimken. The visual aspiration is premium anime fighting-game / episode presentation, with expressive body motion, sharp artwork, strong gold aura and cyan-blue energy, against a dark purple cosmic backdrop with a sun and moon.

It is a solo character showcase, not a complete fighting game. Image quality matters more than free-roaming 3D. The user repeatedly rejected crude procedural characters, placeholder avatars, blurry effects, static/blocky movement, and whole-scene flashing. Reference images were quality targets, not requests to paste a static image into the scene.

The user has accepted the current imported character and asked us to concentrate on animation, rendering and effects. Keep UI minimal: wordmark, settings icon, action dock and essential controls. Do not bring back all old debug settings on the normal page.

## Character: preserve this asset

- Current definition: `src/engine/hero-asset.json`
- Active GLB: `public/characters/imported/meshy-hero/455844cbad360431.glb`
- SHA256: `455844cbad360431cba31acc29dfcf7e03d533108d4acb0ddf89ffc66ee95760`
- User manually generated the original in Meshy: `Meshy_AI_super_saiyan_goku_mod_1004173344_image-to-3d-texture.glb`.
- Locally processed hero: 179,999 triangles, 21-bone humanoid skeleton, skinned mesh, original 4096-square color and normal maps, 2048-square roughness/metalness maps.
- Local processing / Blender rig work: `art/hero/meshy-manual/`.
- Explicit humanoid bone mapping is in the definition. External Quaternius clips are mapped there; current showcase actions primarily use pose data and IK.
- No finger joints and no facial blendshapes. Hands can be positioned/oriented but cannot close into fists. Do not claim articulated fists or facial acting.
- Do not replace the character with Seed-san, procedural geometry, or another design. Earlier original-character concept plans and reference avatars are historical.
- Definition fields such as `status: candidate`, `defaultReview`, and review flags are older asset-workflow metadata. Runtime now uses this hero and starts Auto normally. Those fields are not a new request for approval against another character.
- User supplied this asset for local integration; redistribution terms have not been independently verified.

## Current user experience

- Normal URL: Auto training starts unless inspection or reduced motion is active.
- Dock: Auto, Power up, Energy charge, Beam release, More moves, Pause, Fullscreen.
- More moves: Instant dash, Rapid punch combo, Heavy straight punch, Flying punch, Spinning kick, Hover idle, Mid-air combat stance, Impact reaction, Transformation stance.
- Manual actions interrupt Auto. More moves resets its selection after triggering, so it can replay a move.
- Audio & display modal: PC audio, microphone, local music, render quality, cinematic camera, neutral inspection, reduced motion, effects.
- `/?inspection=1`: neutral light, original materials, no effects/post-processing/cosmic background. Useful for evaluating the rig alone.
- `/?debug=1`: legacy diagnostic controls and the older 9.8-second Action sequence.
- `/?inspection=1&debug=1`: neutral rig / pose inspection.
- Space pauses, F fullscreen, S settings; drag to orbit / scroll to zoom.
- Audio capture requires a user gesture and browser permission; actual system-audio availability depends on the browser/capture selection.

## Architecture / files to read

- `src/cinematic-scene.js`: scene orchestration, frame loop, controls, diagnostic canvas data attributes.
- `src/engine/hero-asset.json`, `assets.js`: character selection and definition.
- `src/engine/staged-moves.js`: NEW current twelve-action pack; timed full-body pose keys, human-readable stage descriptions, cues and move metadata.
- `src/engine/showcase-director.js`: base pose schema, older Action sequence, sampling, interruption blending, cue dispatch. `createStagedMoves()` overrides/adds the current named moves after the legacy move definitions.
- `src/engine/freestyle-director.js`: seeded selection of complete actions, avoids the last two moves, adds safe landings after held airborne poses, bounded root locomotion. Randomness chooses choreography, not arbitrary joint angles.
- `src/engine/hero-rig-controls.js`: analytic two-bone IK, hand/foot targets, elbow/knee poles, hip/spine/head/shoulder controls, support-foot pivots, wrist orientation, hover/breathing.
- `src/engine/hero-motion-physics.js`: 120 Hz fixed-step root motion, bounded acceleration/speed, damped braking, gravity, floor contacts. It is not a ragdoll, cloth solver, or full-body dynamics engine.
- `src/engine/hero-finish.js`: restrained cel treatment over authored textures, skinned silhouette outlines.
- `src/engine/vfx-director.js`, `energy-shell.js`, `strike-effects.js`: charge, beam, aura, lightning, particles, strike trails and impacts.
- `src/engine/energy-motion.js`: critically damped springs, movement-driven aura lag, charge squash/stretch, shared subtle beam deformation anchored at the emitter.
- `src/engine/beam-envelope.js`: fast outward beam growth followed by slower width expansion (about 1.25s).
- `src/engine/lighting-director.js`: neutral/cinematic lighting and character-local energy lights.
- `src/engine/cinematic-director.js`: continuous camera position/target/FOV transitions.
- `src/engine/renderer.js`: pixel ratio, adaptive internal buffers, post-processing and critical flashing fix.
- `src/engine/cosmic-world.js`, `environment-director.js`: sky, sun, moon, atmosphere.
- `src/engine/palette.js`: all 51 exact user-approved sRGB palette swatches, JS colors, linear GLSL constants, CSS variables.
- `src/main.js`, `src/style.css`: compact production interface and legacy debug UI.

## Latest completed change: staged movement pack

The user supplied twelve body-action specifications. They are implemented as timed choreography in `staged-moves.js`, with a readable timeline in `art/hero/STAGED-MOVES.md`:

1. Power-up: 3.5s to a held wide stance; knees load, elbows retract, chest lifts, head bows and rises last, arms spread, bounded tension/tremor.
2. Energy charge: torso rotates about 30 degrees, rear foot pivots, hands cup near rear hip, shoulders compress, head aims, brief hold then hands tighten.
3. Beam release: hips initiate, torso/shoulders follow, hands thrust forward together, rear heel lifts, recoil, brace, recovery. Release cue remains at 3.62s; total 6.6s.
4. Instant dash: load knees, drop lead shoulder, arms trail, rapid travel, bent-knee arrival, guard recovery.
5. Rapid combo: jab, cross, body hook, uppercut, small steps and returns to guard.
6. Heavy punch: rear-leg load, hips drive before shoulder, extension, contact hold, small overshoot, recovery.
7. Flying punch: takeoff, trailing legs, delayed fist extension, torso rotation, legs swing forward to brake, landing.
8. Spinning kick: lead-foot pivot, head leads, shoulders then hips, knee chamber, extension, retraction and landing.
9. Hover idle: loose knees, relaxed arms, slow bob and sway.
10. Airborne guard: raised lead knee, trailing rear leg, forward torso and guard hands.
11. Impact reaction: chest/head react first, hips follow, backward step and defensive recovery.
12. Transformation: bowed head and loaded knees, gradual chest lift, arms spread, head rises last into a held stance.

New controls include explicit head pitch/yaw, shoulder drive/lift, elbow poles and tension. Existing arm/leg IK and deterministic follow-through remain separate. Pose curves use monotone cubic interpolation to carry velocity through ordinary keys; repeated keys retain deliberate contact holds. The older debug Action sequence remains a separate legacy choreography.

Move metadata includes clip/blend/root/camera/audio information, but this is a procedural pose/IK showcase, not a general-purpose animation authoring package. Audio cues are currently null; do not claim synthesized action sound effects.

## Visual palette and cosmic assets

The full user palette is saved, including hero, gold power, skin, black, armor, villain, Namek, energy, tech, environment and explosion families. Active mappings: gold/yellow/cream aura; cyan/blue/white charge and beam; yellow impacts; purple environment/UI accents. Action buttons match their effects. Source character textures were preserved rather than globally recolored. Shader swatches are converted once from sRGB to linear, with HDR brightness handled separately.

The moon now uses 2048x1024 NASA LROC/LOLA-derived color and normal maps, retrieved from the MoonExplorer mirror after NASA downloads timed out. Attribution and sources: `public/environment/cosmos/CREDITS.md`. The lunar normal map's south-positive green channel is inverted in Three.js. Moon lighting is isolated from the hero's colorful fill lights.

The sun uses original baked 2048x1024 granulation/sunspot artwork, limb darkening and a restrained irregular corona. `scripts/bake-solar-detail.py` reproduces the texture. It is artwork, not an astronomical simulation. Sky and celestial distances are cinematic. `scripts/build-cosmos.py` produces older background assets; its procedural moon/sun textures are no longer active.

## Critical regression to avoid: whole-scene flashing

A recurring user complaint was genuine blank presentation frames, not simply bright lightning. Preserve these renderer choices unless measurements justify a replacement:

- WebGLRenderer uses `antialias: true` and `preserveDrawingBuffer: true`.
- Composer uses a HalfFloat render target with zero offscreen MSAA samples. Reintroducing offscreen MSAA previously produced blank frames on the capture path.
- Resize adaptive composer buffers BEFORE drawing.
- Resize the presented canvas only for actual CSS size/base DPR changes, not adaptive-quality updates. Resizing it after drawing clears the presented image.
- Restrained FXAA subpixel blending (.35), up to 16x texture anisotropy.
- Camera changes interpolate; no phase-triggered hard cuts or whole-scene exposure pulses.
- Energy deformation is small and continuous. Beam core, shell and rings share deformation; emitter stays anchored to hands.

A prior 105-frame recorded action check reported zero blank frames in `art/previews/cosmos-motion-report.json`. That recording predates the latest staged pack: do not present it as a recording of the new twelve moves. No new temporal blank-frame recording was made after the staged pack; its checks were browser flows and effects-off screenshots.

## Validation and reproduction

Run from `C:/HyYas/fimken-studio`:

```powershell
npm run dev -- --port 5173 --strictPort
npm test
npm run build
npx playwright test tests/browser/staged-moves.spec.js tests/browser/full-pass.spec.js
```

Reuse the existing dev server if port 5173 is already serving this project. Dependencies are already installed locally. Only run `npm install` if needed. Playwright config uses Edge, one worker, and reuses an existing server. Do not edit source files during browser tests: Vite HMR reloads have caused misleading failures.

Latest completed validation:
- 50 unit tests passed, including cue timing at multiple frame rates, finite staged pose data, pause behavior, no-overshoot pose interpolation, IK and planted-foot pivot checks.
- Production build passed. Existing large-bundle warning (~954 KB JS) remains.
- Three browser checks passed: cinematic Auto/power-up/beam/UI, beam growth, and all newly exposed staged actions without effects.
- Screenshots were inspected, including rear-hip charge and dash, plus a contact sheet of the staged poses. Passing tests does not mean the motion is production-quality or that arbitrary poses cannot self-intersect.

Useful local outputs (ignored by Git):
- `art/previews/staged-moves-review.jpg`
- `art/previews/staged-charge-neutral.png`
- `art/previews/staged-*-neutral.png`
- `art/previews/full-pass-powerup.png`
- `art/previews/full-pass-beam.png`
- `art/previews/action-sequence.webm` (older debug Action sequence, not the new pack)

Canvas diagnostic attributes include `data-ready`, `data-move`, `data-move-time`, `data-stage`, `data-phase`, `data-progress`, `data-auto`, `data-beam-visible`, `data-beam-radius`, `data-beam-length`, `data-root-position`, and `data-postprocessing`.

## Boundaries and honest limitations

- No paid API or Meshy calls are needed for continuing the current renderer/animation work. The earlier $10 image API cap was for a specific texture pass; it is not fresh authorization for new spending. No new subscriptions.
- Never print, copy into this file, or commit API keys. Local .env files and .meshy state are excluded by .gitignore. This handover contains no secrets.
- Preserve authored asset identity and texture resolution. Do not regenerate or silently swap the hero.
- Finger articulation, facial expression, cloth simulation, opponent interactions, damage and arbitrary natural-language motion synthesis are not implemented.
- Render target quality can reach a 4K-sized budget, but that is not a guarantee of native 4K/60 fps on the user's machine. Performance should be measured independently of screenshot/video overhead.
- Further animation polish should be evaluated with effects disabled, then with VFX. Pay attention to shoulder deformation, believable hand contact, foot placement and camera framing. The rig is coarse and some gestures remain approximate.
- Keep meaningful progress updates short, do the authorized work, and avoid repeatedly asking for permission for routine local edits.

## Session of 4-5 October 2026 (after the handover above)

Read this section as overriding anything earlier that it contradicts.

- Dev server: 5173 had died; the local server now runs on 5174 and a LAN one on 5175 (`npx vite --host 0.0.0.0 --port 5175`). Scripts and Playwright honour `FIMKEN_PORT`.
- GPU: the laptop has Intel UHD + RTX 3050 Ti. Chrome was rendering on the Intel chip (about 5 fps). A per-user Windows graphics preference for chrome.exe was set to high performance; it applies after Chrome restarts. On the RTX the scene holds roughly 56-60 fps at 1080p and 1440p.
- Renderer: heat haze, grade, tone mapping and sRGB are one pass (`finish`); bloom blurs from half resolution with re-weighted levels; canvas multisampling is only on for `?inspection=1` and `?debug` pages; the resolution governor targets 60 fps from measured GPU time. Speed lines live in the `finish` pass.
- Flashing: a real cause was found and fixed. `pow()` on a slightly negative value in an aura shader produced an invalid pixel that bloom spread over the frame. Keep `pow()` inputs clamped in every effect shader. `scripts/check-blank-frames.mjs` plays the beam and steps every move looking for black frames.
- Performance overlay: press P or add `?perf=1`. `window.__fimken` exists in dev builds only.
- Hands: the wrist stays in line with the forearm with a limited bend (`hero-rig-controls.js`). Hands are still open; there are no finger joints.
- Effects added: `energy-flame.js` (banded flame aura behind the hero, lightning bolts, ground glow, peak flare), `energy-burst.js` (star at the beam source, fireball and smoke at the impact), floating rocks, removed the gold ground ring and the one-pixel lightning lines.
- Cameras: per-move shots in `cinematic-director.js` (powerBuild, powerPeak, chargeHero, beamImpact, strikeHero, hoverHero, heroClose, flightWide). `fixed:true` keeps a shot in world space.
- Moves: 14 now. `flip` (backflip) and `flight` (a lap of the arena) use a new `flip` pose channel that pitches the root about its own side axis; the root uses YXZ rotation order.
- Auto: with sound playing, the music section picks the pool of moves (quiet/breakdown float, build gathers power, flow fights, peak goes all out), a drop fires a fast-charged beam, and strikes follow the detected tempo.
- Look: stronger cel banding and a thicker outline; rocky ground to 21 m and a ring of rock spires from 11 m.
- Tools: `scripts/measure-performance.mjs`, `render-snapshots.mjs`, `review-motion.mjs`, `check-blank-frames.mjs`. Outputs are under `art/previews/`.
- Not done: closed fists and faces (no rig), opponents, sky/Namek/villain/skin palette colours, dash-specific camera, flight aura that follows the body's pitch. Only stills and sampled frames were reviewed; nobody has watched the moves play continuously.
- Latest checks: 50 unit tests, three browser checks, build, and the blank-frame sweep (824 stepped frames, 0 black) pass. `render-quality.spec.js` has a timing race and was not re-run.

### Later on 5 October 2026

- Reference: `dbz_20s_visual_target_animatic_h264.mp4` in the project root is the look to match.
- Sky: `cosmic-world.js` adds an atmosphere dome (sky blue to royal blue to purple, banded clouds) over the starfield. Fill light is sky blue above, purple below.
- Rocks: `rock-geometry.js` builds craggy faceted rock for spires, boulders, floating rocks and impact shrapnel. The area in front of the hero is kept clear.
- Beam: shaded core (white centre to blue edge), violet-fringed shell, an electric sheath, a star at the hands. Impact: energy ball, fireball with smoke, climbing fire, embers, flung rock, shock ring, firelight.
- Ground draw order: the floor has `renderOrder = -8`. Without it the see-through floor painted over beams and flames in front of it.
- Effect shaders are compiled at load against the composer buffer, which removed a half-second stall on the first beam.
- Auto variation (`freestyle-director.js`): moves may be mirrored, turned to a random heading and paced between 0.88x and 1.18x; the last three moves are not repeated.
- Paused seeking does not advance the beam-radius spring, so stills taken by seeking from an earlier beam time show a thin beam. Capture the later time first.
- Cameras follow `scene.followPoint()` (hips height minus the rest hip height), not the root, so flips stay framed; relative shots rotate with `director.heading`. The capture scripts do the same.
- `director.rehearse(id,{mirror,heading})` plays one move with a chosen variation; `scripts/rehearse-variations.mjs` makes sheets of them.
- Release: the star at the hands swells for the first half second of the beam. The impact fireball sits above its landing point so the ground does not cut it flat; flame bases are ragged.
- Ground: 520 rubble stones (`environment-director.js`, deterministic placement, none within 2.4 m of centre) over a mottled, cracked ground; spires use detail-4 ridged rock. Moon and sun stay by the user's request. The one-pixel cyan float trail was removed.
- GLSL note: `patch` is a reserved word in the shader compiler; a variable named that broke the ground material once.
- Fingers (5 October): the hero GLB is now `d83795dd625a2b13.glb` with 51 bones. `art/hero/rig_fingers.py` adds finger chains; the fingers are fused in the mesh so they curl together as a fist via the `fist` pose channel (0-1) in `hero-rig-controls.js`. Punches, guard, power-up and flight clench; charge and hover stay open. Individual fingers cannot be splayed. The earlier "no finger joints" statements above are superseded. Still no face rig.
- Face (5 October): hero GLB is now `a20e6b25806694c5.glb` with two shape keys from `art/hero/face_keys.py`: `focus` (brows knit, eyes narrow) and `shout` (jaw drops, cruder because the mouth is painted). Pose channels `focus` and `shout` drive them, eased in `character-controller.js`. No blink is possible: the eyes are texture, not geometry.
- Sky: clouds have three tones (shaded underside, body, lit rim). Sun and moon are smaller and sit high and far (moon r1.45 at (-11,15,-34), sun r1.15 at (13,19,-40)); user asked to keep them. Spires use three rock shapes over three instanced meshes; rubble uses detail-2 rock.
- Energy look (5 October): `hero-finish.js` adds an additive skinned glow hull (gold rim) driven by power via `setGlow`; beam shell has fine filaments; `EnergyBurst` takes `detail` for fine rays (muzzle, tip, and a charge `halo`); bloom strength/radius scale with power (0.18-0.38, radius 0.18-0.40); energy and orb lights are much stronger. Bloom above about 0.4 washed the character out; keep it below that.
- Colour (5 October): energy is deep blue and purple (deepBeamBlue/deepRoyalBlue bodies, white only on the beam centre line and burst cores). The gold aura fades out while charge or beam is live (`goldFx`), and the `finish` pass has a `cold` grade that tints the frame blue during beams. Bursts take `intensity`; additive bursts use a small `hot` core.
- UI (5 October): the action dock is hidden on the normal page; `?controls=1` or `?inspection=1` shows it (tests and `measure-performance.mjs` use `?controls=1`). A sound chip in the top bar opens the Audio & display dialog and shows the live source. Beats flare the flame aura and punch the camera, bass swells the aura, highs brighten sparks. Auto starts at load and the music section picks the moves.
- Beat sync (5 October): in Auto with a confident tempo, a finished move waits for the next beat (up to two beats) before the next starts; each move's rate is fitted so its duration is a whole number of beats (0.8-1.35x); every beat dips the knees, lifts the shoulders and nods the head (`director.pulse`). Verified against a simulated 120 bpm track and the in-app demo rhythm, not yet with real captured audio.
- `art/hero/MOVEMENT-BIBLE.md` (5 October) is the user's 60-entry movement vocabulary and sound-mapping target. Built entries are marked; the rest are the animation backlog. Follow its two rules (kinetic chain; anticipation / fast hit / short hold / slow recovery) for every new move.
- Bible pass (5 October): 14 new moves (bounce, combatIdle, stepForward, stepBack, shuffle, vanish, frontKick, backKick, highKick, heavyKick, airCombo, hardLanding, threePoint, reset), 26 total. `music-state.js` now emits `bassHit`, `crescendo`, `sustained`; `freestyle-director.js` maps bass hit -> heavy, crescendo -> blast, drop -> dash, sustained -> hover, interrupting only SOFT moves (bounce, combatIdle, steps, shuffle, reset, stance, hover). Section pools were rebuilt around the new moves. Keys without an explicit phase get guard / float / punch / kick from the pose.
- Sound sync rework (5 October): `freestyle-director.js` ranks moves in five TIERS. Silence draws from tiers 0-2 only (a training session: idle, warm-ups, footwork, light strikes). With sound, the tier follows `music.rolling` (quiet->warm-up, loud->heavy/air/energy) with section nudges; tier 3+ moves start on the bar's first beat (`beatCount%4===0`), smaller ones on any beat. Bass hit -> heavy/heavyKick only on even beats with a 5 s cooldown. Five warm-up moves added (relaxedIdle, alert, stretch, neckRoll, wristWarmup); 31 moves total. Logo: `public/logos/` holds the user's marks; the top bar uses `fimken-mark-256.png` + `fimken-wordmark-120.png`, favicon is `favicon.png` from the emblem.
- Camera drift (5 October): `cinematic-director.js` adds a slow orbit, vertical breathing and push on every held shot (about 6 cm range, under 2 mm per frame) plus a small pull-in on beats. `tests/cinematic.test.js` allows 30 cm around the mark and checks no frame jumps after the shot transition.
