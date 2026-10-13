import data from './mocap/clips.json' with { type: 'json' };
// Real motion capture as moves. Clips come from the CMU motion-capture database (free for any use),
// converted offline by scripts/convert-mocap.mjs into this rig's own pose parameters, so they go
// through the same limb keep-out, life layer, music director and effects as hand-keyed moves.
export const MOCAP_IDS = { punch: [], kick: [], block: [] };
export function createMocapMoves({ K, move, poses }) {
  const { guard } = poses, moves = {};
  for (const clip of data.clips) {
    const id = 'mocap_' + clip.id;
    const keys = clip.keys.map(({ at, ...pose }) => K(at, guard, pose));
    moves[id] = move(clip.label, keys, clip.cues.map(cue => ({ ...cue })));
    MOCAP_IDS[clip.kind].push(id);
  }
  return moves;
}
