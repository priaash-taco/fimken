# Fimken

Fimken is a real-time, music-reactive anime hero showcase that runs entirely in the browser. A fully rigged
character trains, fights and powers up on a stylised world, and every move is chosen and shaped by the sound
you play: bass hits become strikes, quiet passages become warm-ups, and drops become power-ups. It is built
with Vite and three.js; audio analysis, physics and effects all run locally and nothing is uploaded.

Engineering notes, decisions and the history of the motion and rig work are in
[CLAUDE_HANDOVER.md](CLAUDE_HANDOVER.md).

## Controls

Open the settings with the gear beside the wordmark (or press S).

- **Sound sources**: PC audio (choose Entire screen and enable system audio in the browser picker),
  Microphone, a local music file, Demo (silent, scripted energy) and First Light (a short original score).
  Capture only starts from a user gesture and audio never leaves the device. Sound sensitivity scales the response.
- **Vibes**: a lens dropdown that restyles the whole frame: Current, Noir (light sculpture), Volume
  (cinematic energy) and Chroma (motion art).
- **Anime exaggeration**: 0 to 100%. Scales twist, lean, bank and crouch, and pushes reaches outward. Off for reduced motion.
- **Motion blur**: velocity-based blur on the hero and effects.
- **Render quality**: Performance, Balanced or High (up to a 3840 x 2160 render target with adaptive resolution;
  this is not a promise of sustained 4K/60). The page also steps quality down if frames get slow.
- Also available: camera view, environment, playback speed, training routine, character finish.

Keyboard: `Space` pause, `F` fullscreen, `S` settings, `P` performance mode, `T` animate on twos, `?` help.
Drag the canvas to orbit and scroll to zoom. Useful URL options: `?inspection=1` (neutral light, no post effects),
`?controls=1`, `?lens=noir`, `?exaggeration=0.6`, `?debug=1` (development panels).

## Requirements

A current Chromium-based browser (Chrome or Edge) or Firefox with WebGL2. A discrete GPU is strongly
recommended: the scene is heavy (a 180k triangle hero, post-processing, particles) and on integrated graphics it
runs best on the Performance setting. Safari and mobile browsers load the page but are not tuned.

## Run locally

    npm install
    npm run dev          # http://127.0.0.1:5173

## Build and deploy

    npm run build        # plain production build into dist/
    npm run release      # build, prune to deployable assets, then smoke-check the built site

`npm run release` runs `vite build`, then `scripts/release-prune.mjs` (keeps only the hero GLB named in
`src/engine/hero-asset.json`; drops raw Meshy source, debug characters, studies and concept art; prints sizes and
fails above 60 MB), then `scripts/release-check.mjs` (serves dist with `vite preview` on port 5312, loads it in
Edge via Playwright, waits for `#battle[data-ready="true"]`, fails on console errors and saves
`art/previews/product/release.png`). The deployed site is about 53 MB.

The build base comes from `BASE_PATH` (default `/`). GitHub Pages serves a project site under `/fimken/`:

    BASE_PATH=/fimken/ npx vite build && node scripts/release-prune.mjs

`.github/workflows/pages.yml` does this on every push to `main` (install, `npm test`, build, prune, deploy with
`actions/deploy-pages`). `.github/workflows/ci.yml` runs the tests and a build on pull requests. To enable Pages
once: `gh api -X POST repos/priaash-taco/fimken/pages -f build_type=workflow`.

## Character pipeline (in brief)

`src/engine/hero-asset.json` defines the active character. The hero is a Meshy-generated model rigged locally in
Blender (humanoid skeleton with finger bones and 21 ARKit-named facial blendshapes, original 4K PBR maps kept);
`scripts/import-character.mjs` validates and stages a GLB with its bone mapping and provenance, and promotion
needs neutral-light and deformation review. Motion is layered: hand-keyed moves (`src/engine/staged-moves.js`),
a library of real motion capture clips converted to this rig (`src/engine/mocap/clips.json`, loaded lazily),
transitions by inertialization and pose matching, then a body-style layer (balance, hips and gaze lead, the
exaggeration dial), secondary motion and a face performance layer driven by the music. Rebuild steps for the
rig are in `art/hero/` and the capture pipeline in `art/mocap/README.md`.

## Tests

    npm test             # node unit tests
    npm run test:browser # Playwright (Edge); starts the dev server if one is not running

## Third-party notices

See [LICENSES.md](LICENSES.md). In short: three.js and @pixiv/three-vrm are MIT; the CMU motion capture data is
free to use; Quaternius animations and the Poly Haven studio HDR are CC0; the Meshy character model is supplied by
the project owner and its redistribution terms have not been verified.
