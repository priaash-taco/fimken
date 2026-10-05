import hero from './hero-asset.json' with { type: 'json' };

const DEBUG_GOKU = Object.freeze({
  id: 'goku', name: 'Goku', url: '/characters/goku-hero/goku-scene.glb',
  format: 'gltf', height: 2.18, facing: 0, shading: 'anime', animationRig: 'fimken',
  credit: 'Goku fan art / local geometry and rig / AI-generated material sources', temporary: true, status: 'debug', provenance: { kind: 'procedural' },
  clips: { idle: 'hover', anticipation: 'charge', walk: 'move', run: 'rush',
    gesture: 'dodge', turn: 'hover', jump: 'powerup', float: 'hover', land: 'recover',
    powerup: 'powerup', charge: 'charge', blast: 'blast', recover: 'recover',
    punch: 'punch', kick: 'kick', impact: 'clash', hero: 'hover' },
});
export const ENVIRONMENT = Object.freeze({
  id: 'obsidian', hdr: '/environments/studio.hdr',
  credit: 'Studio Small 09 / Sergej Majboroda / Poly Haven / CC0',
});

const REFERENCE_RIG = Object.freeze({
  id: 'reference-seed', name: 'Seed-san / rig reference only', status: 'reference',
  url: '/characters/seed/seed.vrm', format: 'vrm', height: 2, facing: 0,
  finish: 'cinematic', materialRoles: { hair:'hair', huku_bake:'cloth', body_bake:'skin', eye:'eye', eye_trans:'eye', arm_mat:'hard', arm_plastic:'hard' },
  shading: 'authored', animationRig: 'quaternius', animations: '/animations/universal.gltf',
  provenance: { kind: 'external', source: 'https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san', license: 'VRM Public License 1.0' },
  credit: 'Seed-san / VirtualCast, Inc. / VRM Public License 1.0. Animation: Quaternius / CC0.',
  clips: { idle:'Idle_Loop', anticipation:'Punch_Enter', walk:'Walk_Loop', run:'Sprint_Loop',
    gesture:'Punch_Cross', turn:'Idle_Loop', jump:'Jump_Start', float:'Jump_Loop', land:'Jump_Land',
    powerup:'Spell_Simple_Enter', charge:'Spell_Simple_Idle_Loop', blast:'Spell_Simple_Shoot',
    recover:'Spell_Simple_Exit', punch:'Punch_Jab', kick:'Punch_Cross', impact:'Hit_Chest', hero:'Idle_Loop' },
});
export function resolveCharacter(search = '', candidate = hero) {
  const requested = new URLSearchParams(search).get('character');
  if (requested === 'debug-goku') return DEBUG_GOKU;
  if (requested === 'reference') return REFERENCE_RIG;
  if (candidate.status === 'ready' || ((requested === 'candidate' || candidate.defaultReview) && candidate.status === 'candidate')) {
    if (candidate.provenance?.kind !== 'external' || !candidate.url) throw new Error('Production characters require an external asset and provenance.');
    return candidate;
  }
  // User-approved temporary external rig; never substitute the procedural debug model.
  return REFERENCE_RIG;
}
export const CHARACTER = Object.freeze(resolveCharacter(globalThis.location?.search || ''));
