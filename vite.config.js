import { defineConfig } from 'vite';

// BASE_PATH lets the same build serve from the site root ('/', default) or from a project page
// such as https://<user>.github.io/fimken/ (BASE_PATH=/fimken/).
const normalise = p => { const s = ('/' + (p || '/')).replace(/\/+/g, '/'); return s.endsWith('/') ? s : s + '/'; };
const base = normalise(process.env.BASE_PATH);

// Engine sources address public/ files with root-absolute strings ('/characters/...', '/audio/...').
// Under a sub-path those would 404, so in builds with a non-root base prefix them at build time.
const PUBLIC_DIRS = 'characters|animations|environments|environment|audio|artwork|logos';
function prefixPublicUrls() {
  const pattern = new RegExp(`(["'\`])/(${PUBLIC_DIRS})/`, 'g');
  return {
    name: 'fimken-public-base', enforce: 'post', apply: 'build',
    transform(code, id) {
      if (base === '/' || id.includes('node_modules') || !/\.(js|json)(\?|$)/.test(id)) return null;
      const next = code.replace(pattern, `$1${base}$2/`).replace(/href="\/"/g, `href="${base}"`);
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  base,
  plugins: [prefixPublicUrls()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 2000, // the lazy clip library chunk is about 1.9 MB (loaded after first paint)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@pixiv/')) return 'vrm';
        },
      },
    },
  },
});
