import * as THREE from 'three';
// One tileable noise texture shared by every energy effect, so the aura, beam, orb and fire are all
// animated by scrolling and warping the same fields instead of by geometry or per-pixel hashing.
//   R: soft fbm (large lobes)   G: medium fbm (warp and edge breakup)
//   B: ridged fbm (wisps, filaments)   A: fine fbm (grain, streak detail)
// Every channel wraps seamlessly, so scrolling it forever never shows a seam.
const SIZE = 256;
function lattice(cells, seed) {
  let s = (seed * 2654435761) >>> 0; const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) { s = (1664525 * s + 1013904223) >>> 0; grid[i] = s / 4294967296; }
  return grid;
}
function valueNoise(grid, cells, x, y) {
  const fx = x * cells, fy = y * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10), sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
  const at = (i, j) => grid[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
function fbm(layers, x, y, ridged) {
  let total = 0, amplitude = .5, norm = 0;
  for (const { grid, cells } of layers) { let n = valueNoise(grid, cells, x, y); if (ridged) n = 1 - Math.abs(2 * n - 1); total += n * amplitude; norm += amplitude; amplitude *= .5; }
  return total / norm;
}
export function noiseTexture() {
  const plan = [[4, 5, false, 11], [8, 4, false, 23], [5, 4, true, 37], [16, 3, false, 53]];
  const channels = plan.map(([base, octaves, ridged, seed]) => ({ ridged, layers: Array.from({ length: octaves }, (_, k) => ({ cells: base * 2 ** k, grid: lattice(base * 2 ** k, seed + k * 7) })) }));
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) channels.forEach((channel, c) => {
    const n = fbm(channel.layers, x / SIZE, y / SIZE, channel.ridged);
    // Stretch the contrast so thresholds in the shaders have a full range to work with.
    data[(y * SIZE + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(((n - .5) * 1.7 + .5) * 255)));
  });
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  return texture;
}
