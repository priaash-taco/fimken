import * as THREE from 'three';

const NUMBERS = ['shadingToonyFactor','shadingShiftFactor','giEqualizationFactor','rimLightingMixFactor','parametricRimFresnelPowerFactor','parametricRimLiftFactor','outlineWidthFactor','outlineLightingMixFactor'];
const COLORS = ['color','shadeColorFactor','parametricRimColorFactor','outlineColorFactor'];
const PROFILES = {
  skin: { shade:[.72,.43,.40], toony:.78, shift:-.16, gi:.62, rim:[.035,.045,.065], width:.00065, ink:'#573943' },
  eye: { shade:[.58,.49,.63], toony:.82, shift:-.12, gi:.85, rim:[0,0,0], width:0, ink:'#272037' },
  hair: { shade:[.24,.29,.43], toony:.94, shift:-.06, gi:.38, rim:[.14,.22,.36], width:.0008, ink:'#171a2a' },
  cloth: { shade:[.27,.29,.43], toony:.90, shift:-.12, gi:.43, rim:[.07,.10,.17], width:.00125, ink:'#282b43' },
  hard: { shade:[.32,.34,.44], toony:.87, shift:-.10, gi:.48, rim:[.11,.15,.23], width:.0011, ink:'#242939' },
};

// Material names are configured per asset. Unknown assets retain their authored look.
export class CharacterLook {
  constructor(model, roles = {}) {
    this.entries = []; this.mode = 'authored'; this.inspection = false; this.outlineScale = 1;
    const seen = new Set();
    model.traverse(node => { if(node.isMesh) for(const material of [node.material].flat()) {
      if(!material.isMToonMaterial || seen.has(material)) continue;
      seen.add(material);
      const name=material.name.replace(/ \(Outline\)$/, ''), role=roles[name];
      const saved=Object.fromEntries(NUMBERS.map(key=>[key,material[key]]));
      for(const key of COLORS) saved[key]=material[key].clone();
      this.entries.push({material,role,saved});
    }});
  }
  apply(mode = this.mode, inspection = this.inspection) {
    this.mode=mode; this.inspection=inspection;
    for(const {material:m,role,saved} of this.entries) {
      for(const key of NUMBERS) m[key]=saved[key];
      for(const key of COLORS) m[key].copy(saved[key]);
      const p=mode==='cinematic' && PROFILES[role];
      if(p) {
        m.shadeColorFactor.setRGB(...p.shade);m.shadingToonyFactor=p.toony;
        m.shadingShiftFactor=p.shift;m.giEqualizationFactor=p.gi;
        m.parametricRimColorFactor.setRGB(...p.rim);m.rimLightingMixFactor=.7;
        m.parametricRimFresnelPowerFactor=role==='hair'?4.5:5.5;m.parametricRimLiftFactor=0;
        m.outlineColorFactor.set(p.ink);m.outlineLightingMixFactor=.25;
        // Preserve materials whose authored outline is disabled (eyes/transparent shells).
        if(m.outlineWidthMode!=='none') m.outlineWidthFactor=p.width;
      }
      if(inspection) m.parametricRimColorFactor.setRGB(0,0,0);
      if(m.outlineWidthMode!=='none') m.outlineWidthFactor*=this.outlineScale;
    }
  }
  setOutlineScale(scale) { this.outlineScale=THREE.MathUtils.clamp(scale,0,2.4);this.apply(); }
}
