// Real motion capture as moves. Clips come from the CMU motion-capture database (free for any use),
// converted offline by scripts/convert-mocap.mjs into this rig's own pose parameters, so they go
// through the same limb keep-out, life layer, music director and effects as hand-keyed moves.
//
// The clip library is about 2 MB, so it is loaded lazily: the hand-keyed moves are available at
// first paint and the captured ones register when the library arrives (loadMocapLibrary). Anything
// that depends on the captured ids (the freestyle tiers) subscribes with onMocapLoaded.
export const MOCAP_IDS = { punch: [], kick: [], block: [], jump: [], flow: [] };
let context = null, promise = null, loaded = false;
const listeners = new Set();
// Called by createStagedMoves with its keyframe helpers; the library needs them to build moves.
export function setMocapContext(ctx) { context = ctx; }
export function createMocapMoves({ K, move, poses }, data) {
  const { guard } = poses, moves = {};
  for (const clip of data.clips) {
    const id = 'mocap_' + clip.id;
    const keys = clip.keys.map(({ at, ...pose }) => K(at, guard, pose));
    moves[id] = move(clip.label, keys, clip.cues.map(cue => ({ ...cue })));
    if (!MOCAP_IDS[clip.kind].includes(id)) MOCAP_IDS[clip.kind].push(id);
  }
  return moves;
}
export const mocapLoaded = () => loaded;
// Runs fn(ids) once the library is registered (immediately if it already is).
export function onMocapLoaded(fn) { if (loaded) fn(MOCAP_IDS); else listeners.add(fn); }
// Loads the clips and registers them in SHOWCASE_MOVES. Safe to call repeatedly; tests await it.
export function loadMocapLibrary() {
  promise ??= (async () => {
    const [{ default: data }, { SHOWCASE_MOVES }] = await Promise.all([
      import('./mocap/library.js'), import('./showcase-director.js')]);
    if (!context) throw new Error('mocap context missing: createStagedMoves has not run');
    Object.assign(SHOWCASE_MOVES, createMocapMoves(context, data));
    loaded = true;
    for (const fn of listeners) fn(MOCAP_IDS);
    listeners.clear();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fimken:mocap-loaded', { detail: { ids: MOCAP_IDS } }));
    return MOCAP_IDS;
  })();
  return promise;
}
