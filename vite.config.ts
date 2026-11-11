import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dentalcad-pages/core': path.resolve(__dirname, 'packages/core/src'),
      '@dentalcad-pages/viewer': path.resolve(__dirname, 'packages/viewer/src'),
    },
  },
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
