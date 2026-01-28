/**
 * Types for @verifyfetch/webllm
 *
 * Provides verified, resumable model loading for WebLLM.
 */

import type { ChunkedInfo, SRIString } from 'verifyfetch';

/**
 * Information about a single model file with integrity hash
 */
export interface ModelFileInfo {
  /** SRI hash of the complete file (sha256-BASE64) */
  sri: SRIString;

  /** File size in bytes (required for chunked files) */
  size?: number;

  /** Chunked verification config for large files (enables resumable downloads) */
  chunked?: ChunkedInfo;
}

/**
 * Model entry in the verification manifest
 */
export interface ModelEntry {
  /** Base URL for model files (e.g., "https://huggingface.co/user/model/resolve/main/") */
  baseUrl: string;

  /** Map of filename to file info */
  files: Record<string, ModelFileInfo>;
}

/**
 * Verification manifest for WebLLM models
 *
 * @example
 * ```json
 * {
 *   "version": 2,
 *   "models": {
 *     "Phi-3-mini-4k-instruct-q4f16_1-MLC": {
 *       "baseUrl": "https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC/resolve/main/",
 *       "files": {
 *         "mlc-chat-config.json": { "sri": "sha256-abc..." },
 *         "params_shard_0.bin": {
 *           "sri": "sha256-full...",
 *           "size": 536870912,
 *           "chunked": { "root": "sha256-root...", "chunkSize": 1048576, "hashes": [...] }
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface ModelVerificationManifest {
  /** Manifest version (must be 2 for chunked support) */
  version: 1 | 2;

  /** Map of model ID to model entry */
  models: Record<string, ModelEntry>;
}

/**
 * Verification options for VerifiedMLCEngine
 */
export interface VerificationConfig {
  /** URL to fetch the verification manifest from */
  manifestUrl?: string;

  /** Inline manifest (alternative to manifestUrl) */
  manifest?: ModelVerificationManifest;

  /** Behavior on verification failure: 'block' throws error, 'warn' logs warning */
  onFail?: 'block' | 'warn';

  /** Enable resumable downloads (persists progress to IndexedDB) */
  resumable?: boolean;

  /** Custom cache name for storing verified files (default: 'webllm-verified') */
  cacheName?: string;
}

/**
 * Progress information for model preloading
 */
export interface PreloadProgress {
  /** Current phase: 'verifying' or 'complete' */
  phase: 'verifying' | 'complete';

  /** Current file being processed */
  file: string;

  /** Bytes downloaded and verified for current file */
  bytesVerified: number;

  /** Total bytes for current file (if known) */
  totalBytes?: number;

  /** Percent complete for current file (0-100) */
  percent: number;

  /** Whether this file download was resumed from previous attempt */
  resumed: boolean;

  /** Number of files completed */
  filesComplete: number;

  /** Total number of files to download */
  totalFiles: number;

  /** Download speed in bytes/second */
  speed: number;

  /** Estimated time remaining in milliseconds */
  eta?: number;
}

/**
 * Options for preloading a model
 */
export interface PreloadOptions {
  /** URL to fetch the verification manifest from */
  manifestUrl?: string;

  /** Inline manifest (alternative to manifestUrl) */
  manifest?: ModelVerificationManifest;

  /** Progress callback */
  onProgress?: (progress: PreloadProgress) => void;

  /** Behavior on verification failure */
  onFail?: 'block' | 'warn';

  /** Enable resumable downloads */
  resumable?: boolean;

  /** Custom cache name */
  cacheName?: string;

  /** Custom fetch implementation */
  fetchImpl?: typeof fetch;

  /** Timeout per request in milliseconds */
  timeout?: number;
}

/**
 * Result of preloading a model
 */
export interface PreloadResult {
  /** Model ID that was preloaded */
  modelId: string;

  /** Whether any files were resumed from previous download */
  resumed: boolean;

  /** Number of files that were resumed */
  filesResumed: number;

  /** Total number of files downloaded */
  totalFiles: number;

  /** Total bytes downloaded */
  totalBytes: number;

  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Error thrown when model verification fails
 */
export class ModelVerificationError extends Error {
  constructor(
    public readonly modelId: string,
    public readonly file: string,
    public readonly expected: SRIString,
    public readonly actual: SRIString,
    public readonly chunkIndex?: number
  ) {
    const chunkInfo = chunkIndex !== undefined ? ` (chunk ${chunkIndex})` : '';
    super(
      `Model verification failed for ${modelId}/${file}${chunkInfo}\n` +
      `  Expected: ${expected}\n` +
      `  Actual:   ${actual}\n\n` +
      `This could indicate:\n` +
      `  - File corruption during transfer\n` +
      `  - CDN serving wrong content\n` +
      `  - Potential tampering\n\n` +
      `The download will not proceed. Check your manifest hashes.`
    );
    this.name = 'ModelVerificationError';
  }
}

/**
 * Error thrown when manifest is invalid
 */
export class ManifestError extends Error {
  constructor(message: string) {
    super(`Invalid manifest: ${message}`);
    this.name = 'ManifestError';
  }
}

/**
 * Error thrown when model is not found in manifest
 */
export class ModelNotFoundError extends Error {
  constructor(modelId: string, availableModels: string[]) {
    super(
      `Model "${modelId}" not found in manifest.\n` +
      `Available models: ${availableModels.join(', ') || '(none)'}`
    );
    this.name = 'ModelNotFoundError';
  }
}
