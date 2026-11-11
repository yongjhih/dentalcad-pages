import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages base: relative path ensures assets load properly regardless of domain/repo subpath
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 15MB STL files are in public/, so no need to inline
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
