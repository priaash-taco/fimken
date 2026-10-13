# Motion capture source

Clips come from the CMU Graphics Lab Motion Capture Database in the BVH conversion at
https://github.com/Shriinivas/cmubvh (conversion by Bruce Hahn). CMU places no restrictions on use of
the original dataset, and the conversion adds none.

Raw BVH files are not committed (about 60 MB). To fetch the ones in use and rebuild the moves:

    node scripts/fetch-mocap.mjs
    node scripts/convert-mocap.mjs

The converter writes `src/engine/mocap/clips.json` (the moves) and `art/mocap/targets.json` (expected
joint positions, used by `scripts/check-mocap.mjs`). Add clips by listing them in `CLIPS` in the converter
and adding the subject's folder to `SEQUENCES` in the fetch script.

What is in the library (kind decides which freestyle tier a move joins):

| Kind | Source | Tier |
| --- | --- | --- |
| punch | karate lunge punches, punch sequences, backstep and feint attacks | training and up |
| block | karate blocks, punching blocks, dodges, side steps | training and up |
| kick | karate front, round and side kicks, front kicks | harder tiers |
| jump | standing and forward jumps | harder tiers |
| flow | karate katas (Bassai, Empi, Heian), tai chi, a full stretch, footwork, guard stance | quiet and training |

Left out on purpose: clips where the body lies on the floor or goes upside down (rolls, cartwheels,
flips, get-ups), because the rig has no floor-contact or inverted-body support yet, and runs and walks
that travel more than about a metre and a half.
