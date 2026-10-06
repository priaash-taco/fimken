import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// Forked lightning, as crackles across the whole frame in the animatic: each arc is a jagged main
// path (midpoint displacement) with two branches, drawn as a camera-facing ribbon with a white
// core and a blue halo. Arcs live a fraction of a second, then re-roll, so they flicker and jump.
const MAX_SEGMENTS = 34;
export class EnergyArcs {
  constructor(scene, count = 11) {
    this.count = count; this.arcs = Array.from({ length: count }, () => ({ segments: [], born: -9, life: 0, fade: 1, tint: 0 }));
    const quads = count * MAX_SEGMENTS;
    this.positions = new Float32Array(quads * 12); this.uv = new Float32Array(quads * 8); this.fade = new Float32Array(quads * 4); this.tint = new Float32Array(quads * 4);
    const index = []; for (let q = 0; q < quads; q++) { const v = q * 4; index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); for (let k = 0; k < 4; k++) this.uv.set([k % 2, k < 2 ? 0 : 1], (v + k) * 2); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2)); geometry.setAttribute('fade', new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage)); geometry.setAttribute('tint', new THREE.BufferAttribute(this.tint, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(index);
    this.uniforms = { strength: { value: 0 } };
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float fade;attribute float tint;varying vec2 vUv;varying float vFade;varying float vTint;void main(){vUv=uv;vFade=fade;vTint=tint;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: shaderPalette + `uniform float strength;varying vec2 vUv;varying float vFade;varying float vTint;
      void main(){float across=abs(vUv.x*2.-1.);float core=smoothstep(.32,.0,across),halo=exp(-across*across*3.2);
       vec3 haloColor=mix(p_kamehamehaBlue,p_villainVioletGlow,vTint)*2.;vec3 color=mix(haloColor,p_spiritGlowWhite*3.,core);
       gl_FragColor=vec4(color,(core*.9+halo*.4)*vFade*strength);}` }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 5; scene.add(this.mesh);
    this.seed = 12345; this.side = new THREE.Vector3(); this.mid = new THREE.Vector3(); this.dir = new THREE.Vector3();
  }
  random() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  randomDirection(flat = .6) { const a = this.random() * Math.PI * 2, y = (this.random() * 2 - 1) * flat, r = Math.sqrt(1 - y * y); return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); }
  // Jagged polyline between two points: repeated midpoint displacement, smaller offsets each pass.
  path(a, b, levels, jitter) {
    let points = [a, b];
    for (let l = 0; l < levels; l++) {
      const next = [points[0]];
      for (let i = 0; i < points.length - 1; i++) {
        const m = points[i].clone().add(points[i + 1]).multiplyScalar(.5), edge = points[i + 1].clone().sub(points[i]);
        const off = this.randomDirection(1).multiplyScalar(jitter / (1 + l * 1.15)); off.addScaledVector(edge.normalize(), -off.dot(edge)); next.push(m.add(off), points[i + 1]);
      }
      points = next;
    }
    return points;
  }
  roll(arc, centre, reach) {
    const start = centre.clone().addScaledVector(this.randomDirection(.8), .35 + this.random() * .6), end = centre.clone().addScaledVector(this.randomDirection(.55), reach * (.55 + this.random() * .6));
    const main = this.path(start, end, 4, reach * .22), segments = [];
    for (let i = 0; i < main.length - 1; i++) segments.push([main[i], main[i + 1], 1]);
    for (let b = 0; b < 2; b++) {
      const at = main[Math.floor(main.length * (.25 + this.random() * .5))], branchEnd = at.clone().addScaledVector(this.randomDirection(.6), reach * (.25 + this.random() * .3));
      const branch = this.path(at, branchEnd, 3, reach * .12); for (let i = 0; i < branch.length - 1 && segments.length < MAX_SEGMENTS; i++) segments.push([branch[i], branch[i + 1], .55]);
    }
    arc.segments = segments.slice(0, MAX_SEGMENTS); arc.life = .05 + this.random() * .16; arc.tint = this.random() < .12 ? 1 : 0;
  }
  update(time, centre, strength, camera, reach = 2.6) {
    this.mesh.visible = strength > .02; if (!this.mesh.visible) return;
    this.uniforms.strength.value = Math.min(1, strength);
    const active = Math.max(1, Math.ceil(Math.min(1, strength) * this.count)), p = this.positions;
    p.fill(0); this.fade.fill(0);
    for (let i = 0; i < active; i++) {
      const arc = this.arcs[i];
      if (time - arc.born > arc.life || time < arc.born) { this.roll(arc, centre, reach); arc.born = time; arc.fade = this.random() < .72 ? .7 + this.random() * .3 : 0; }
      if (arc.fade <= 0) continue;
      for (let s = 0; s < arc.segments.length; s++) {
        const [a, b, weight] = arc.segments[s], q = (i * MAX_SEGMENTS + s) * 4;
        this.mid.copy(a).add(b).multiplyScalar(.5); this.dir.copy(b).sub(a);
        this.side.crossVectors(this.dir, this.mid.clone().sub(camera.position)).normalize().multiplyScalar(.0085 * weight * (.7 + reach * .12));
        p.set([a.x - this.side.x, a.y - this.side.y, a.z - this.side.z, a.x + this.side.x, a.y + this.side.y, a.z + this.side.z, b.x - this.side.x, b.y - this.side.y, b.z - this.side.z, b.x + this.side.x, b.y + this.side.y, b.z + this.side.z], q * 3);
        for (let k = 0; k < 4; k++) { this.fade[q + k] = arc.fade * (.5 + .5 * weight); this.tint[q + k] = arc.tint; }
      }
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.fade.needsUpdate = true; g.attributes.tint.needsUpdate = true;
  }
}
