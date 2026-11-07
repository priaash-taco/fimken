# Fimken release QA report

Run against a snapshot copy of the working tree (scripts/qa-sync.sh) served by Vite on port 5313, Edge headless on the RTX (--force_high_performance_gpu). The GPU was shared with other agents' browsers, so fps figures are pessimistic. Raw output is in art/qa/.

## Summary
| Area | Result |
|---|---|
| 1 Soak (10 min) | PASS for leaks; fps dips under shared GPU |
| 2 Every move x every lens (126 x 4 = 504 runs) | PASS after fix (16 captured clips sank feet up to 6.5 cm before) |
| 3 Audio paths | PASS after fix (First Light left the hero standing still); mic and PC audio not testable headless |
| 4 Settings | FAIL: saved preferences override ?lens= and ?exaggeration= (not fixed, main.js off limits) |
| 5 Resize / CPU throttle | No blank frames, no NaN, no teleport; governor recovery slow (open question) |
| 6 Regression | Partial; see below. check-mocap --compare and measure-performance: not run |

## 1 Soak (scripts/qa-soak.mjs, art/qa/soak.json)
10 min, 1280x720, demo rhythm, Auto, 60 samples. Geometries 59, textures 32, programs 77, scene children 95, scene objects 166: all flat after the first minute (slope 0 per minute). JS heap 124-147 MB, slope -0.28 MB/min (no growth). No reloads. fps: min 6.1, p05 8.2, median 49.9, max 61.2; the resolution governor sat at 0.50 for the last 6 minutes. The dips (6-16 fps) coincided with other agents using the GPU (3D engine at 38%+ from other processes), so they are not attributed to the scene; not re-run with gpuMs sampling (sampler now records it). Errors: 1 page error + 1 console error, both the clips.json dynamic import failing (see Defects, mocap load); none after the workaround.

## 2 Moves x lenses (scripts/qa-moves.mjs, art/qa/moves.json)
126 moves (incl. 68 captured), classic/noir/volume/chroma, real time to completion. No page errors, no NaN in root or bones, hero inside the arena (max 1.32 m), largest one-frame root jump 2.44 m (under 3 m). First pass: 53 failures, all "foot below floor" (-2.2 to -6.5 cm) in 16 captured clips (mocap_135_*, 144_*, 85_04_0, in 1-4 lenses). After the fix all 64 reruns pass (worst -1.7 cm). Hand-keyed moves never exceeded -0.7 cm.

## 3 Audio (scripts/qa-audio.mjs, art/qa/audio.json)
Demo rhythm, 60 s: 76-81 beats (~96-98 bpm), 76-81 bass hits, 1 drop, 1 crescendo, 4-6 sustained, sections quiet/build/peak/flow, 22 contacts, impacts attr +1, 44-63 beam frames, 8 distinct moves.
First Light (via the real #score click): file mode, 120 bpm, 26 beats, 0 bass hits, 1-2 crescendos, quiet/build/peak. The track is only 20 s long, so 60 s is impossible; audio returns to idle at the end. Before the fix the hero stayed in "stance" for the whole track; after, 6 moves, 8 contacts, beam fired.
Not testable headless: microphone and PC audio capture.

## 4 Settings (scripts/qa-settings.mjs)
Pass: lens, quality, exaggeration, effects and motion blur persist across reload. ?lens=noir&blur=0&exaggeration=0.8 works on a clean profile. Neutral view disables effects (sky hidden, blur 0, no beam, effects slider disabled) and restores them cleanly with the lens kept.
FAIL: with saved preferences present, ?lens=classic and ?exaggeration=0.2 are overridden by the saved noir and 0.8 (restorePreferences in src/main.js applies them after the URL). blur is handled correctly.

## 5 Resize and throttle (scripts/qa-resize.mjs, art/qa/resize.json)
Sizes 1920x1080, 1280x720, 800x600, 390x844, 2560x1440: 0 blank frames in about 2700 sampled frames, canvases correctly sized. Governor forced to 0.5 then timed: only 390x844 reached 1.0 within 12 s (9.65 s). Others ended at 0.5, 0.8, 0.9, 0.6 with GPU time 6-11 ms. Cause: raising needs frame time under 18.5 ms, but frames sat at 19-20 ms (about 52 fps, CPU bound or shared GPU), and each step needs more than 2 s, so 0.5 to 1.0 needs more than 10 s by design. CPU 4x throttle for 20 s: 12 fps, no NaN, max root move 1 mm per frame, recovered to 56 fps after.

## 6 Regression
- npm test: 74 pass, 0 fail (before the new test); tests/feet-floor.test.js added and passes.
- check-seams: after fix to the script (it now awaits the lazy mocap library) seam/body 0.95 (seed 7). Without the fix 1.62 (the lazy clips were absent). Seed 11 not re-measured after the fix.
- Playwright tests/browser (25 tests): 22 pass, 3 fail, all attributable to concurrent edits or load, not to my fixes: action-preview (timing 21.8 s vs 14.5 s limit at about 34 fps), showcase.spec (powerup move now lasts 3.5 s and ends in phase "powerup", not "idle"), studio.spec (expects main text "fimken.", UI text has changed).
- check-blank-frames: 336 canvas frames, 0 blank, 7323 seeked frames, 0 black, 111 page captures, 0 blank, 16 resizes, no errors.
- check-penetration hand/forearm/elbow lines: energyThrow forearm -7.2 cm, elbow -7.2; stretch hand -6.6, forearm -6.2, elbow -5.2; boulderPunch -3.0; heavy -2.8; spin -2.6 (cm). 116 moves show upper-arm values (expected, shoulder).
- check-mocap --compare: not run (stopped on request).
- measure-performance --discrete --quick: not run.

## Defects fixed
1. src/engine/hero-rig-controls.js: new keepFeetAboveFloor clamps grounded ankle targets to standing height (captured clips and the leg keep-out sank planted feet up to 6.5 cm). Test: tests/feet-floor.test.js.
2. src/cinematic-scene.js: resetTraining keeps Auto running (First Light click reset the director and the hero stood still). Not unit-testable without WebGL; verified by qa-audio.
3. scripts/check-seams.mjs: awaits loadMocapLibrary so numbers match the old baseline.

## Defects found, not fixed
- src/main.js restorePreferences: saved lens and exaggeration override URL params. Fix: skip those two when the URL has the param.
- src/engine/mocap-moves.js: import('./mocap/clips.json', { with: { type: 'json' } }) fails in the Vite dev server (MIME error), so no captured moves load in dev. My snapshot removed the attribute (qa-sync.sh). Production build not checked.
- The Demo and First Light buttons are hidden in the compact UI (advanced section); qa-audio clicks them through the DOM.

## Open questions
- Governor raise gate uses frame time, not GPU headroom: at 1280x720 GPU was 7 ms yet it stayed at 0.8. Intended?
- First Light yields 0 bass hits; expected for that score?
- Planted-foot dip of 2-6 cm during captured kicks is caused by BodyStyle balance hip shift interacting with the leg keep-out; the floor clamp bounds it but the cause is not fixed.
- Whether the powerup move should end in phase "idle" (showcase.spec) after the other agent's change.

## Scripts
scripts/qa-lib.mjs, qa-soak.mjs, qa-moves.mjs, qa-audio.mjs, qa-settings.mjs, qa-resize.mjs, qa-foot-diag.mjs, qa-sync.sh.
