import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'grammar-app',
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: '../dist/grammar',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
