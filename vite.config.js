import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import tslOperatorPlugin from 'vite-plugin-tsl-operator';
import plainText from 'vite-plugin-plain-text';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': path.resolve(rootDir, 'src/core'),
      '@modules': path.resolve(rootDir, 'src/modules'),
      '@presets': path.resolve(rootDir, 'src/presets'),
    },
  },
  assetsInclude: ['**/*.hdr'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('tweakpane')) return 'vendor-tweakpane';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 1234,
  },
  plugins: [
    tslOperatorPlugin({ logs: false }),
    plainText([/\.obj$/], { namedExport: false }),
  ],
});
