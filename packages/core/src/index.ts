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

// Core functions
export { verifyFetch, verifyFetchStream, verifyStream, computeSri } from './verify-fetch.js';

// Manifest-aware fetcher
export {
  createVerifyFetcher,
  parseManifest,
  createManifest,
  addArtifact,
} from './fetcher.js';

// WASM loader utilities
export { initWasm, createHasher, hash, validateSri, isUsingWasm } from './wasm-loader.js';

// Merkle tree utilities
export {
  generateMerkleTree,
  verifyChunk,
  createMerkleVerifier,
  DEFAULT_CHUNK_SIZE,
} from './merkle.js';
export type { MerkleVerifier, ChunkVerificationResult } from './merkle.js';

// Types
export type {
  // Options
  VerifyFetchOptions,
  VerifyFetchStreamOptions,
  VerifyFetcherOptions,
  OnFailBehavior,

  // Streaming types
  VerifyFetchStreamResult,

  // Manifest types (v1)
  VFManifest,
  VFArtifact,

  // Manifest types (v2 with Merkle support)
  VFManifestV2,
  VFArtifactV2,
  VFManifestAny,
  MerkleInfo,

  // Utility types
  HashAlgorithm,
  SRIString,
  StreamingHasher,
  VerifiedFetcher,
} from './types.js';

// Content-Addressable URLs with multi-CDN failover
export {
  parseContentAddressableUrl,
  createContentAddressableUrl,
  verifyFetchFromSources,
  resolveContentAddressable,
} from './content-addressable.js';
export type { MultiSourceOptions } from './content-addressable.js';

// Errors
export { IntegrityError, SignatureError } from './types.js';
