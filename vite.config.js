import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `dev` and `preview` both resolve command: 'serve' (only `isPreview` tells
// them apart), so the real sub-path applies to `build` and `preview` — where
// the app is actually served from it — while plain `dev` stays at `/`, which
// is where `npm run dev` opens.
export default defineConfig(({ command, isPreview }) => {
  const usesRealBase = command === 'build' || isPreview;
  const basePath = usesRealBase ? process.env.VITE_BASE_PATH || '/Nihongo/' : '/';

  return {
    root: 'grammar-app',
    plugins: [react()],
    base: basePath,
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Vite 8's rolldown bundler only accepts the function form, unlike
          // classic Rollup's object-shorthand `{ vendor: [...] }`.
          manualChunks(id) {
            if (/node_modules\/(react|react-dom|react-router-dom|zustand|lucide-react)\//.test(id)) {
              return 'vendor';
            }
          },
        },
      },
    },
    test: {
      globals: true,
      // Split by file type, not folder: pure-logic tests (`*.test.ts`, including the
      // ones under features/) stay on the fast node project; rendered component
      // tests (`*.test.tsx`) get a DOM.
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['src/**/*.test.ts'],
            setupFiles: ['src/test/setup.node.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'jsdom',
            environment: 'jsdom',
            include: ['src/**/*.test.tsx'],
            setupFiles: ['src/test/setup.node.ts', 'src/test/setup.dom.ts'],
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/__tests__/**', 'src/test/**', 'src/**/*.d.ts', 'src/data/**', 'src/generated/**'],
        reporter: ['text-summary', 'text'],
      },
    },
  };
});
