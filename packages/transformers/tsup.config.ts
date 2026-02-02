import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  splitting: false,
  target: 'es2022',
  outDir: 'dist',
  external: [
    '@huggingface/transformers',
    'verifyfetch',
  ],
  banner: {
    js: `/**
 * @verifyfetch/transformers - Verified, resumable model loading for Transformers.js
 * https://verifyfetch.com | https://github.com/hamzaydia/verifyfetch
 * License: Apache-2.0
 */`,
  },
});
