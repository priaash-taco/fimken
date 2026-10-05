import * as THREE from 'three';
// Craggy, faceted rock: a subdivided icosahedron pushed in and out by layered value noise,
// optionally tapered toward the top for spires. Vertex colours darken the base and creases.
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = v => v * v * (3 - 2 * v), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const lerp = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), u), lerp(h(0, 1, 0), h(1, 1, 0), u), v), lerp(lerp(h(0, 0, 1), h(1, 0, 1), u), lerp(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
export function rockGeometry({ detail = 2, taper = 0, seed = 0, roughness = .42 } = {}) {
  const geometry = new THREE.IcosahedronGeometry(1, detail), position = geometry.attributes.position, colors = new Float32Array(position.count * 3), p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    // Sample noise on the unit direction so vertices shared between faces stay welded.
    const ridge = (x, y, z) => 1 - Math.abs(2 * noise(x, y, z) - 1);
    const n = noise(p.x * 1.6 + seed, p.y * 1.6, p.z * 1.6) * .5 + ridge(p.x * 3.7, p.y * 3.7 + seed, p.z * 3.7) * .3 + ridge(p.x * 8.5, p.y * 8.5, p.z * 8.5 + seed) * .14 + noise(p.x * 17, p.y * 17 + seed, p.z * 17) * .06;
    const height = p.y * .5 + .5, squeeze = 1 - taper * height * height;
    p.multiplyScalar(1 + (n - .5) * 2 * roughness); p.x *= squeeze; p.z *= squeeze;
    position.setXYZ(i, p.x, p.y, p.z);
    const shade = (.45 + .55 * height) * (.6 + .8 * n);
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
