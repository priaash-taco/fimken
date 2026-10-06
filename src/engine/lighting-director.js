import { PALETTE } from './palette.js';
import * as THREE from 'three';

// Sky-blue light from above, purple bounce from below.
const SKY_FILL = '#8fb9f2';
export class LightingDirector {
  constructor(scene) {
    this.fill = new THREE.HemisphereLight(SKY_FILL, '#3a2756', .7);
    this.key = new THREE.DirectionalLight(PALETTE.energyWhite, 1.5);
    this.key.position.set(-3.5, 4, 2.6); this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3, near: .1, far: 18 });
    this.key.shadow.bias = -.0002; this.key.shadow.normalBias = .008;
    this.rim = new THREE.DirectionalLight(PALETTE.undershirtBlueHighlight, 2.0); this.rim.position.set(2.8, 3, -2.5);
    this.energy = new THREE.PointLight(PALETTE.superSaiyanGold, 0, 6, 2);
    this.floorLight = new THREE.SpotLight(PALETTE.villainVioletGlow, 24, 18, .55, .9, 2);
    this.floorLight.position.set(0, 6, -2); this.floorLight.target.position.set(0, 0, 0);
    this.orb = new THREE.PointLight(PALETTE.kamehamehaCyan,0,3.5,2);scene.add(this.orb);
    this.gold = new THREE.Color(PALETTE.superSaiyanGold);
    scene.add(this.fill, this.key, this.key.target, this.rim, this.energy, this.floorLight, this.floorLight.target);
  }
  setInspection(enabled) {
    this.inspection = enabled;
    this.fill.color.set(enabled ? '#ffffff' : SKY_FILL);
    this.fill.groundColor.set(enabled ? '#777777' : '#3a2756');
    this.key.color.set(enabled ? '#ffffff' : PALETTE.energyWhite);
    this.key.intensity = 1.5;
    this.floorLight.visible = !enabled;
  }
  setMood(mood, effects) {
    const l = mood.levels, dim = (l.powerUp * .3 + l.charge * .5 + l.release * .45 + l.impact * .2) * effects;
    this.fill.intensity = .7 * (1 - dim); this.key.intensity = 1.5 * (1 - dim * .6);
    this.floorLight.intensity = 24 * (1 - dim * .7);
  }
  update(position, power, effects, actor, signals) {
    if(actor)actor.palm(this.orb.position);
    this.orb.intensity=this.inspection?0:(signals?.charge||0)*effects*2.2;
    this.key.target.position.copy(position).y += 1;
    this.energy.position.copy(position).add(new THREE.Vector3(0, 1.1, .6));
    // Gold energy takes over the back rim as power rises, so the silhouette reads against the aura.
    const glow = Math.max(0, power - .22) / .78 * effects;
    this.energy.intensity = power * effects * 1.2 + glow * 4.5;
    this.rim.color.set(PALETTE.undershirtBlueHighlight).lerp(this.gold, glow * .8);
    this.rim.intensity = this.inspection ? 0 : 2 + power * effects * .6 + glow * 1.6;
  }
  setQuality(size) {
    if (this.key.shadow.mapSize.x === size) return;
    this.key.shadow.mapSize.set(size, size);
    this.key.shadow.map?.dispose(); this.key.shadow.map = null; this.key.shadow.needsUpdate = true;
  }
}
