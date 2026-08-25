import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// vite-plugin-singlefile forces `base: './'` in its own config() hook (it
// inlines every asset, so it doesn't need one) and overrides whatever we set
// below. That makes Vite's own `base` / `import.meta.env.BASE_URL` unusable
// as the router's basename while the plugin is active. VITE_APP_BASENAME is
// a separate, plugin-proof env var wired in via `define` for that purpose.
// Phase 2 drops the plugin and can fold this back into `base`.
//
// `dev` and `preview` both resolve command: 'serve' (only `isPreview` tells
// them apart), so the real sub-path applies to `build` and `preview` — where
// the app is actually served from it — while plain `dev` stays at `/`, which
// is where `npm run dev` opens.
export default defineConfig(({ command, isPreview }) => {
  const usesRealBase = command === 'build' || isPreview;
  const basePath = usesRealBase ? process.env.VITE_BASE_PATH || '/Nihongo/' : '/';

  return {
    root: 'grammar-app',
    plugins: [react(), viteSingleFile()],
    base: basePath,
    define: {
      'import.meta.env.VITE_APP_BASENAME': JSON.stringify(basePath),
    },
    build: {
      outDir: '../dist/grammar',
      emptyOutDir: true,
    },
    test: {
      globals: true,
      environment: 'node',
    },
  };
});
