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
    '@mlc-ai/web-llm',
    'verifyfetch',
  ],
  banner: {
    js: `/**
 * @verifyfetch/webllm - Verified, resumable model loading for WebLLM
 * https://verifyfetch.com | https://github.com/hamzaydia/verifyfetch
 * License: Apache-2.0
 */`,
  },
});
