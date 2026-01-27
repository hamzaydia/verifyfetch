import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    auto: 'src/auto.ts',
    worker: 'src/worker.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false, // Keep readable for security auditing
  treeshake: true,
  splitting: true,
  target: 'es2022',
  outDir: 'dist',
  external: [
    // WASM module is loaded dynamically
    /\.wasm$/,
  ],
  banner: {
    js: `/**
 * VerifyFetch - Verify any file you fetch—before you trust it.
 * https://verifyfetch.com | https://github.com/hamzaydia/verifyfetch
 * License: Apache-2.0
 */`,
  },
});
