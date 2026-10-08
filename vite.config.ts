import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Dev serves every .html (index + sandbox/*.html). Production builds only the game entry.
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') },
      output: {
        // vendor code changes rarely: separate chunks cache across game updates and keep each chunk under the warning size
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/postprocessing/')) return 'postprocessing';
          return undefined;
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
