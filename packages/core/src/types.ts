/**
 * VerifyFetch Type Definitions
 *
 * @packageDocumentation
 */

/**
 * Supported hash algorithms for SRI verification
 */
export type HashAlgorithm = 'sha256' | 'sha384' | 'sha512';

/**
 * SRI (Subresource Integrity) string format
 * Example: "sha256-BASE64HASH" or "sha384-BASE64HASH"
 */
export type SRIString = `sha256-${string}` | `sha384-${string}` | `sha512-${string}`;

/**
 * Behavior when verification fails
 * - 'block': Throw an IntegrityError (default)
 * - 'warn': Log warning to console but continue
 * - { fallbackUrl: string }: Try fetching from fallback URL instead
 */
export type OnFailBehavior = 'block' | 'warn' | { fallbackUrl: string };

/**
 * Options for verifyFetch()
 */
export interface VerifyFetchOptions {
  /**
   * SRI hash to verify against (required)
   * Format: "sha256-BASE64" or "sha384-BASE64" or "sha512-BASE64"
   */
  sri: SRIString;

  /**
   * What to do when verification fails
   * @default 'block'
   */
  onFail?: OnFailBehavior;

  /**
   * Custom fetch implementation (optional)
   * Useful for testing or Node.js environments
   */
  fetchImpl?: typeof fetch;

  /**
   * Callback for progress updates during streaming
   * @param bytesProcessed - Number of bytes verified so far
   * @param totalBytes - Total bytes (if known from Content-Length)
   */
  onProgress?: (bytesProcessed: number, totalBytes?: number) => void;
}

/**
 * Options for createVerifyFetcher()
 */
export interface VerifyFetcherOptions {
  /**
   * URL to the VF manifest file
   * The manifest contains SRI hashes for all protected assets
   */
  manifestUrl?: string;

  /**
   * Inline manifest object (alternative to manifestUrl)
   */
  manifest?: VFManifest;

  /**
   * Custom fetch implementation
   */
  fetchImpl?: typeof fetch;

  /**
   * Base URL for resolving relative paths in manifest
   * @default '/'
   */
  baseUrl?: string;
}

/**
 * VF Manifest v1 format
 */
export interface VFManifest {
  /**
   * Manifest version (currently 1)
   */
  version: 1;

  /**
   * Base path for artifact URLs
   */
  base: string;

  /**
   * Map of artifact paths to their integrity info
   */
  artifacts: Record<string, VFArtifact>;
}

/**
 * Individual artifact entry in the manifest
 */
export interface VFArtifact {
  /**
   * SRI hash of the artifact
   */
  sri: SRIString;

  /**
   * URL to detached signature file (optional)
   * @remarks Reserved for v0.2 - Ed25519 signature verification
   */
  signature?: string;

  /**
   * Issuer of the signature (optional)
   * 'self' for self-signed, or key ID for managed keys
   * @remarks Reserved for v0.2 - Ed25519 signature verification
   */
  issuer?: string;
}

/**
 * Error thrown when integrity verification fails
 */
export class IntegrityError extends Error {
  public readonly url: string;
  public readonly expectedSri: SRIString;
  public readonly actualSri: SRIString;

  constructor(url: string, expectedSri: SRIString, actualSri: SRIString) {
    const message = `Integrity check failed for ${url}\n` +
      `  Expected: ${expectedSri}\n` +
      `  Actual:   ${actualSri}\n\n` +
      `This could indicate:\n` +
      `  - The file was corrupted in transit\n` +
      `  - The CDN/server is serving a different version\n` +
      `  - A potential supply chain attack\n\n` +
      `To fix: Update your SRI hash to "${actualSri}" if the new file is trusted.\n` +
      `Learn more: https://verifyfetch.com/docs/integrity-errors`;

    super(message);
    this.name = 'IntegrityError';
    this.url = url;
    this.expectedSri = expectedSri;
    this.actualSri = actualSri;
  }
}

/**
 * Error thrown when signature verification fails
 * @remarks Reserved for v0.2 - Ed25519 signature verification is not yet implemented
 */
export class SignatureError extends Error {
  public readonly url: string;

  constructor(url: string, reason: string) {
    const message = `Signature verification failed for ${url}\n` +
      `  Reason: ${reason}\n\n` +
      `This could indicate:\n` +
      `  - The signature file is missing or corrupted\n` +
      `  - The wrong public key is being used\n` +
      `  - The file was modified after signing\n\n` +
      `Learn more: https://verifyfetch.com/docs/signature-errors`;

    super(message);
    this.name = 'SignatureError';
    this.url = url;
  }
}

/**
 * Streaming hasher interface (implemented by WASM or SubtleCrypto fallback)
 */
export interface StreamingHasher {
  update(data: Uint8Array): void;
  finalize(): SRIString | Promise<SRIString>;
  readonly bytes_processed: number;
}

/**
 * Result of verifyFetchStream()
 * Provides a stream that can be consumed while verification happens in parallel
 */
export interface VerifyFetchStreamResult {
  /**
   * ReadableStream of verified chunks
   * In non-Merkle mode: chunks are streamed but verification completes at the end
   * In Merkle mode: each chunk is verified before being yielded
   */
  stream: ReadableStream<Uint8Array>;

  /**
   * Promise that resolves when verification completes successfully
   * Rejects with IntegrityError if verification fails
   * In non-Merkle mode: resolves after entire file is downloaded and verified
   * In Merkle mode: resolves after all chunks are verified
   */
  verified: Promise<void>;

  /**
   * Total bytes (if known from Content-Length header)
   */
  totalBytes?: number;
}

/**
 * Options for verifyFetchStream()
 */
export interface VerifyFetchStreamOptions extends VerifyFetchOptions {
  /**
   * Enable Merkle tree verification mode
   * Requires manifest v2 with merkle data for the file
   * Each chunk will be verified before being yielded to the consumer
   */
  merkle?: boolean;
}

/**
 * Merkle tree information for chunked verification
 */
export interface MerkleInfo {
  /**
   * Merkle root hash (SRI format)
   */
  root: SRIString;

  /**
   * Size of each chunk in bytes
   * @default 1048576 (1MB)
   */
  chunkSize: number;

  /**
   * Array of chunk hashes (SRI format)
   * tree[0] is hash of chunk 0, tree[1] is hash of chunk 1, etc.
   */
  tree: SRIString[];
}

/**
 * VF Manifest v2 format with Merkle tree support
 */
export interface VFManifestV2 {
  /**
   * Manifest version
   */
  version: 2;

  /**
   * Base path for artifact URLs
   */
  base: string;

  /**
   * Map of artifact paths to their integrity info
   */
  artifacts: Record<string, VFArtifactV2>;
}

/**
 * Individual artifact entry in manifest v2
 */
export interface VFArtifactV2 {
  /**
   * SRI hash of the entire artifact (for backwards compatibility)
   */
  sri?: SRIString;

  /**
   * File size in bytes (required for Merkle mode)
   */
  size?: number;

  /**
   * Merkle tree information for chunked verification
   */
  merkle?: MerkleInfo;

  /**
   * URL to detached signature file (optional)
   * @remarks Reserved for Ed25519 signature verification
   */
  signature?: string;

  /**
   * Issuer of the signature (optional)
   */
  issuer?: string;
}

/**
 * Union type for all manifest versions
 */
export type VFManifestAny = VFManifest | VFManifestV2;

/**
 * Verified fetcher instance returned by createVerifyFetcher()
 */
export interface VerifiedFetcher {
  /**
   * Preload the manifest (recommended at app startup)
   * This ensures the manifest is loaded before any fetches,
   * providing fail-fast behavior and faster first fetch.
   */
  preload(): Promise<void>;

  /**
   * Fetch and verify, returning the Response
   */
  fetch(url: string, init?: RequestInit): Promise<Response>;

  /**
   * Fetch, verify, and return as ArrayBuffer
   */
  arrayBuffer(url: string, init?: RequestInit): Promise<ArrayBuffer>;

  /**
   * Fetch, verify, and return as Blob
   */
  blob(url: string, init?: RequestInit): Promise<Blob>;

  /**
   * Fetch, verify, and parse as JSON
   */
  json<T = unknown>(url: string, init?: RequestInit): Promise<T>;

  /**
   * Fetch, verify, and return as text
   */
  text(url: string, init?: RequestInit): Promise<string>;

  /**
   * Reload the manifest (useful after updates)
   */
  reloadManifest(): Promise<void>;
}
