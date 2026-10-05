import * as THREE from 'three';

export class ImpactParticles {
  constructor(scene, count = 280) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.cursor = 0;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.material = new THREE.PointsMaterial({ size: .065, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.fragments = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.08, 0), new THREE.MeshStandardMaterial({ color: '#9883b4', roughness: .9 }), 32);
    this.fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fragments.frustumCulled = false;
    this.fragmentState = Array.from({ length: 32 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, size: 0 }));
    this.fragmentCursor = 0;
    this.transform = new THREE.Object3D();
    scene.add(this.fragments);
    this.updateFragments(0);
  }
  burst(position, color = '#bba3ff', strength = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < Math.ceil(30 + strength * 45); k++) {
      const i = this.cursor++ % this.count, j = i * 3;
      const azimuth = Math.random() * Math.PI * 2, vertical = Math.random() * 2 - 1;
      const horizontal = Math.sqrt(1 - vertical * vertical), speed = 1.4 + Math.random() * 5 * strength;
      this.positions.set([position.x, position.y, position.z], j);
      this.velocity.set([Math.cos(azimuth) * horizontal * speed, vertical * speed, Math.sin(azimuth) * horizontal * speed], j);
      this.colors.set([c.r * 2, c.g * 2, c.b * 2], j);
      this.life[i] = .5 + Math.random() * .8;
    }
    for (let i = 0; i < 8; i++) {
      const fragment = this.fragmentState[this.fragmentCursor++ % this.fragmentState.length];
      fragment.p.copy(position);
      fragment.v.set(Math.random() - .5, Math.random() - .25, Math.random() - .5).multiplyScalar(6 * strength);
      fragment.life = 1.4;
      fragment.size = .5 + Math.random();
    }
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      if (this.life[i] <= 0) { this.colors.fill(0, j, j + 3); continue; }
      this.life[i] -= dt;
      this.velocity[j + 1] -= dt * 1.1;
      for (let axis = 0; axis < 3; axis++) {
        this.velocity[j + axis] *= Math.exp(-dt * .55);
        this.positions[j + axis] += this.velocity[j + axis] * dt;
        this.colors[j + axis] *= Math.exp(-dt * 2.5);
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.updateFragments(dt);
  }
  updateFragments(dt) {
    this.fragmentState.forEach((fragment, i) => {
      fragment.life = Math.max(0, fragment.life - dt);
      fragment.v.y -= dt * .8;
      fragment.v.multiplyScalar(Math.exp(-dt * .5));
      fragment.p.addScaledVector(fragment.v, dt);
      this.transform.position.copy(fragment.p);
      this.transform.rotation.set(fragment.life * (i + 1), i + fragment.life * 3, 0);
      this.transform.scale.setScalar(fragment.size * Math.min(1, fragment.life * 3));
      this.transform.updateMatrix();
      this.fragments.setMatrixAt(i, this.transform.matrix);
    });
    this.fragments.instanceMatrix.needsUpdate = true;
  }
  clear() {
    this.life.fill(0); this.colors.fill(0); this.geometry.attributes.color.needsUpdate = true;
    this.fragmentState.forEach(f => { f.life = 0; }); this.updateFragments(0);
  }
}
