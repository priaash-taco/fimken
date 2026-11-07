# Third-party notices

| Component | Use | Licence |
| --- | --- | --- |
| three.js (three) | Rendering | MIT |
| @pixiv/three-vrm | VRM loading (reference rig only) | MIT |
| Vite | Build tool | MIT |
| CMU Graphics Lab Motion Capture Database (BVH conversion by Bruce Hahn, github.com/Shriinivas/cmubvh) | Source of the captured moves in `src/engine/mocap/clips.json` | Free to use; CMU places no restrictions on use of the data (see `art/mocap/README.md`) |
| Quaternius Universal Animation Library (standard free edition) | Base animation clips in `public/animations/` | CC0 (`art/licenses/quaternius-cc0.txt`) |
| Studio Small 09, Sergej Majboroda / Poly Haven | HDR environment | CC0 |
| Cosmos textures in `public/environment/cosmos/` | Planet and sky textures | See `public/environment/cosmos/CREDITS.md` |
| First Light | Short score, `public/audio/first-light.wav` | Original, synthesised for this project |
| Seed-san, VirtualCast, Inc. | Rig reference only; not shipped in the release build | VRM Public License 1.0 (`art/licenses/seed-source.md`) |
| Hero character model | Generated with Meshy from a user-supplied image and rigged locally | **Supplied by the project owner. Redistribution terms have not been independently verified.** Confirm the Meshy plan terms and that the source image can be published before making the repository or site public for wide use. |

The production build ships exactly one character file, the hero named in `src/engine/hero-asset.json`. The raw
Meshy source GLB, the debug characters and the study files are excluded by `scripts/release-prune.mjs`.
