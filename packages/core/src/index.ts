/**
 * VerifyFetch - Verify any file you fetch—before you trust it.
 *
 * @packageDocumentation
 *
 * @example Basic usage
 * ```ts
 * import { verifyFetch } from 'verifyfetch';
 *
 * const res = await verifyFetch('/models/phi-3.bin', {
 *   sri: 'sha256-BASE64...'
 * });
 * const model = await res.arrayBuffer();
 * ```
 *
 * @example Manifest-aware fetcher
 * ```ts
 * import { createVerifyFetcher } from 'verifyfetch';
 *
 * const vf = createVerifyFetcher({
 *   manifestUrl: '/vf.manifest.json'
 * });
 *
 * const wasm = await vf.arrayBuffer('/engine.wasm');
 * ```
 */

// Core function
export { verifyFetch, verifyStream, computeSri } from './verify-fetch.js';

// Manifest-aware fetcher
export {
  createVerifyFetcher,
  parseManifest,
  createManifest,
  addArtifact,
} from './fetcher.js';

// WASM loader utilities
export { initWasm, createHasher, hash, validateSri } from './wasm-loader.js';

// Types
export type {
  // Options
  VerifyFetchOptions,
  VerifyFetcherOptions,
  OnFailBehavior,

  // Manifest types
  VFManifest,
  VFArtifact,

  // Utility types
  HashAlgorithm,
  SRIString,
  StreamingHasher,
  VerifiedFetcher,
} from './types.js';

// Errors
export { IntegrityError, SignatureError } from './types.js';
