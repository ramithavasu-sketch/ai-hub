// Bundles src/gas-rules.ts into gas/rules.js, a plain script Apps Script can load.
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    outDir: path.resolve(import.meta.dirname, '../gas'),
    emptyOutDir: false,
    minify: false,
    // Apps Script's V8 runtime lacks some newer syntax (such as ??=), so compile down.
    target: 'es2019',
    lib: { entry: path.resolve(import.meta.dirname, '../src/gas-rules.ts'), name: 'AIHub', formats: ['iife'], fileName: () => 'rules.js' },
  },
});
