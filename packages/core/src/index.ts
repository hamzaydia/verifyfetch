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

// Chunked verification utilities
export {
  generateChunkedHashes,
  verifyChunk,
  createChunkedVerifier,
  DEFAULT_CHUNK_SIZE,
} from './chunked.js';
export type { ChunkedVerifier, ChunkVerificationResult } from './chunked.js';

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

  // Manifest types (v2 with chunked support)
  VFManifestV2,
  VFArtifactV2,
  VFManifestAny,
  ChunkedInfo,

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

// Resumable downloads
export {
  verifyFetchResumable,
  canResume,
  getDownloadProgress,
  cancelDownload,
  ChunkVerificationError,
} from './resumable.js';
export type {
  ResumableFetchOptions,
  ResumableFetchResult,
  ResumableProgress,
} from './resumable.js';

// Storage utilities
export {
  isStorageAvailable,
  clearOldDownloads,
  getAllDownloads,
} from './storage.js';
export type { DownloadState } from './storage.js';

// Errors
export { IntegrityError, SignatureError } from './types.js';
