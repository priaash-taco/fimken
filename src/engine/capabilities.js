// Reports what this browser and device can do, so the page can fail clearly and choose
// a sensible default quality. Probing uses a throwaway canvas that is released straight away.
const INTEGRATED = /intel|uhd|iris|hd graphics|mali|adreno|apple|powervr|videocore|vivante|swiftshader|llvmpipe|software|microsoft basic/i;
const SOFTWARE = /swiftshader|llvmpipe|software|microsoft basic render/i;

export function detectCapabilities() {
  const caps = {
    webgl2: false, floatRenderTargets: false, halfFloatRenderTargets: false, maxTextureSize: 0,
    renderer: 'unknown', vendor: 'unknown', gpuClass: 'unknown', software: false,
    deviceMemory: navigator.deviceMemory ?? null, hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    touch: false, reducedMotion: false, supported: false, problems: [], recommendedQuality: 'high',
  };
  try {
    caps.touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches;
    caps.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { /* Older browsers: leave the defaults. */ }
  let gl = null;
  try {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  } catch { gl = null; }
  if (!gl) {
    caps.problems.push('WebGL 2 is not available');
    return caps;
  }
  caps.webgl2 = true;
  caps.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  // Rendering to half floats needs EXT_color_buffer_half_float or, in WebGL 2, the float extension.
  caps.floatRenderTargets = Boolean(gl.getExtension('EXT_color_buffer_float'));
  caps.halfFloatRenderTargets = caps.floatRenderTargets || Boolean(gl.getExtension('EXT_color_buffer_half_float'));
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (info) {
    caps.renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || 'unknown');
    caps.vendor = String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL) || 'unknown');
  } else {
    caps.renderer = String(gl.getParameter(gl.RENDERER) || 'unknown');
    caps.vendor = String(gl.getParameter(gl.VENDOR) || 'unknown');
  }
  const name = `${caps.vendor} ${caps.renderer}`;
  caps.software = SOFTWARE.test(name);
  caps.gpuClass = caps.renderer === 'unknown' ? 'unknown' : INTEGRATED.test(name) ? 'integrated' : 'dedicated';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (!caps.halfFloatRenderTargets) caps.problems.push('Half-float render targets are not available');
  if (caps.maxTextureSize && caps.maxTextureSize < 4096) caps.problems.push('The graphics card limits textures below 4096 px');
  caps.supported = caps.webgl2 && caps.halfFloatRenderTargets && caps.maxTextureSize >= 4096;
  caps.recommendedQuality = recommendQuality(caps);
  return caps;
}

// Integrated GPUs, software rendering, touch devices and low-memory machines start on
// Performance; everything else on High. The resolution governor still adapts from there.
export function recommendQuality(caps) {
  if (caps.touch || caps.gpuClass === 'integrated' || caps.software) return 'low';
  if ((caps.deviceMemory && caps.deviceMemory <= 4) || (caps.hardwareConcurrency && caps.hardwareConcurrency <= 4)) return 'low';
  return 'high';
}

export const QUALITY_LABELS = { low: 'Performance', balanced: 'Balanced', high: 'High' };
