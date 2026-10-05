import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import goku from '../art/characters/goku.json';

export const CHARACTERS = Object.freeze(Object.fromEntries([goku].map(definition => [definition.id, {
  name: definition.name, url: `/characters/${definition.id}.glb`, energy: `#${definition.palette.energy}`,
}])));
const cache = new Map();
const loader = new GLTFLoader();
const ramp = new THREE.DataTexture(new Uint8Array([62, 125, 204, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export class Character {
  constructor(id) {
    this.root = new THREE.Group();
    this.energyColor = new THREE.Color(CHARACTERS[id].energy);
    this.id = id;
    this.revision = 0;
    this.ready = this.load(id);
  }

  async load(id) {
    const entry = CHARACTERS[id];
    if (!entry) throw new Error('Unknown character.');
    const revision = ++this.revision;
    if (!cache.has(id)) {
      cache.set(id, loader.loadAsync(entry.url).catch(error => { cache.delete(id); throw error; }));
    }
    const gltf = await cache.get(id);
    if (revision !== this.revision) return false;
    const model = clone(gltf.scene);
    model.scale.setScalar(.88);
    model.position.y = -3.65;
    const materials = new Map();
    const outlines = [];
    model.traverse(object => {
      if (!object.isMesh) return;
      object.frustumCulled = false;
      const convert = original => {
        if (!materials.has(original)) {
          const mat = new THREE.MeshToonMaterial({
            color: original.color, map: original.map, gradientMap: ramp,
            side: THREE.FrontSide, name: original.name,
          });
          // Exported texture already contains the pigment colour.
          if (original.map) mat.color.set('#ffffff');
          materials.set(original, mat);
        }
        return materials.get(original);
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      object.castShadow = object.receiveShadow = true;
      if (object.isSkinnedMesh) {
        const ink = new THREE.MeshBasicMaterial({ color: '#231c25', side: THREE.BackSide });
        ink.onBeforeCompile = shader => {
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.011;');
        };
        ink.customProgramCacheKey = () => 'goku-ink-1';
        const outline = new THREE.SkinnedMesh(object.geometry, ink);
        outline.name = 'Character ink silhouette';
        outline.bind(object.skeleton, object.bindMatrix);
        outline.position.copy(object.position);
        outline.rotation.copy(object.rotation);
        outline.scale.copy(object.scale);
        outline.frustumCulled = false;
        outlines.push([object.parent, outline]);
      }
    });
    for (const [parent, outline] of outlines) parent.add(outline);
    const previous = this.model;
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(previous); }
    this.model = model;
    this.root.add(model);
    if (previous) {
      this.root.remove(previous);
      const disposed = new Set();
      previous.traverse(o => {
        if (!o.isMesh) return;
        for (const material of [o.material].flat()) {
          if (!disposed.has(material)) { material.dispose(); disposed.add(material); }
        }
      });
    }
    this.id = id;
    this.energyColor.set(entry.energy);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    this.hand = model.getObjectByName('handR') || model.getObjectByName('hand.R');
    this.head = model.getObjectByName('head');
    this.active = null;
    this.pose('hover', 0, 0, 0);
    return true;
  }

  pose(state, time, power, dt = 1 / 60, progress = null) {
    if (!this.mixer) return;
    const next = this.actions[state] || this.actions.hover;
    if (next !== this.active) {
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if (this.active) this.active.crossFadeTo(next, .22, false);
      this.active = next;
    }
    this.mixer.timeScale = .75 + power * .45;
    this.mixer.update(dt);
    // Reach full extension before advancing to the next move.
    if (progress !== null) {
      next.time = progress * next.getClip().duration;
      this.mixer.update(0);
    }
    this.root.updateMatrixWorld(true);
  }

  palm(target) {
    this.root.updateMatrixWorld(true);
    if (this.hand) return this.hand.getWorldPosition(target);
    return target.set(.4, .4, .5).applyMatrix4(this.root.matrixWorld);
  }
}
