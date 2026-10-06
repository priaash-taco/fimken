import * as THREE from 'three';
// One shared light for the environment: where the hero's energy currently is, its colour and
// strength. Rocks and ground read it in their shaders to catch banded rim light, so the aura,
// the charge orb, the beam and an impact visibly colour the surroundings.
export const ENERGY_LIGHT = { position: { value: new THREE.Vector3(0, 1.1, 0) }, color: { value: new THREE.Color('#F7D64A') }, strength: { value: 0 } };
