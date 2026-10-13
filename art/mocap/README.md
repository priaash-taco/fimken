# Motion capture source

Clips come from the CMU Graphics Lab Motion Capture Database in the BVH conversion at
https://github.com/Shriinivas/cmubvh (conversion by Bruce Hahn). CMU places no restrictions on use of
the original dataset, and the conversion adds none.

Raw BVH files are not committed (about 16 MB). To fetch the ones in use:

    mkdir -p art/mocap/cmu && cd art/mocap/cmu
    B=https://github.com/Shriinivas/cmubvh/raw/main
    for f in Sequence-131-135/135/Data/135_{04,05,07,09,10,11} Sequence-141-144/144/Data/144_{05,13,20,26}; do
      curl -sL -o $(basename $f).zip "$B/$f.zip" && unzip -oq $(basename $f).zip && rm $(basename $f).zip
    done

Then run `node scripts/convert-mocap.mjs`. It writes `src/engine/mocap/clips.json` (the moves) and
`art/mocap/targets.json` (expected joint positions, used by `scripts/check-mocap.mjs`).

Subjects: 135 is karate (front kick, roundhouse, lunge punch, side kick, down block, knife-hand block),
144 is punching, kicking and blocking. Add more clips by listing them in `CLIPS` in the converter.
