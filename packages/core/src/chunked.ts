/**
 * Chunked Verification Implementation
 *
 * Enables fail-fast verification by checking chunks as they download.
 * If a chunk is corrupt, detection happens immediately - no need to
 * download the entire file first.
 *
 * Note: This is NOT a true Merkle tree (no hierarchical hashing or proofs).
 * It's simpler: hash each chunk independently, verify on arrival.
 */

import type { SRIString, ChunkedInfo, HashAlgorithm } from './types.js';
import { createHasher } from './wasm-loader.js';

/**
 * Default chunk size: 1MB
 * Balance between verification granularity and overhead
 */
export const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Generate chunked verification info for a file
 *
 * @param data - The complete file data
 * @param chunkSize - Size of each chunk (default 1MB)
 * @param algorithm - Hash algorithm (default sha256)
 * @returns ChunkedInfo with root hash and per-chunk hashes
 *
 * @example
 * ```ts
 * const data = await fs.readFile('model.bin');
 * const chunked = await generateChunkedHashes(data);
 * // chunked.root = "sha256-abc..."
 * // chunked.hashes = ["sha256-chunk0...", "sha256-chunk1...", ...]
 * ```
 */
export async function generateChunkedHashes(
  data: Uint8Array | ArrayBuffer,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  algorithm: HashAlgorithm = 'sha256'
): Promise<ChunkedInfo> {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const chunks = splitIntoChunks(bytes, chunkSize);

  // Hash each chunk
  const chunkHashes: SRIString[] = [];
  for (const chunk of chunks) {
    const hash = await hashChunk(chunk, algorithm);
    chunkHashes.push(hash);
  }

  // Compute root from chunk hashes (simple concatenation + hash)
  const root = await computeRootHash(chunkHashes, algorithm);

  return {
    root,
    chunkSize,
    hashes: chunkHashes,
  };
}

/**
 * Verify a single chunk against its expected hash
 *
 * @param chunk - The chunk data to verify
 * @param expectedHash - The expected SRI hash
 * @param algorithm - Hash algorithm
 * @returns true if chunk is valid, false otherwise
 */
export async function verifyChunk(
  chunk: Uint8Array,
  expectedHash: SRIString,
  algorithm: HashAlgorithm = 'sha256'
): Promise<boolean> {
  const actualHash = await hashChunk(chunk, algorithm);
  return actualHash === expectedHash;
}

/**
 * Create a streaming chunk verifier
 *
 * This allows verifying chunks as they arrive, enabling fail-fast behavior.
 *
 * @example
 * ```ts
 * const verifier = createChunkedVerifier(chunkedInfo);
 *
 * for await (const chunk of stream) {
 *   const result = await verifier.verifyNextChunk(chunk);
 *   if (!result.valid) {
 *     throw new Error(`Chunk ${result.index} is corrupt`);
 *   }
 *   // Safe to use chunk now
 * }
 *
 * await verifier.finalize(); // Verify all chunks were received
 * ```
 */
export function createChunkedVerifier(chunked: ChunkedInfo): ChunkedVerifier {
  let currentIndex = 0;
  let bytesProcessed = 0;
  let buffer = new Uint8Array(0);

  const algorithm = parseAlgorithmFromSri(chunked.root);
  const chunkHashes = chunked.hashes;

  return {
    get currentChunkIndex() {
      return currentIndex;
    },

    get totalChunks() {
      return chunkHashes.length;
    },

    get bytesProcessed() {
      return bytesProcessed;
    },

    async verifyNextChunk(data: Uint8Array): Promise<ChunkVerificationResult> {
      // Append to buffer
      const newBuffer = new Uint8Array(buffer.length + data.length);
      newBuffer.set(buffer);
      newBuffer.set(data, buffer.length);
      buffer = newBuffer;

      // If all chunks already processed, return partial
      if (currentIndex >= chunkHashes.length) {
        return {
          index: -1,
          valid: true,
          expectedHash: '' as SRIString,
          partial: true,
        };
      }

      // Process complete chunks (not the last one)
      while (buffer.length >= chunked.chunkSize && currentIndex < chunkHashes.length - 1) {
        const chunk = buffer.slice(0, chunked.chunkSize);
        buffer = buffer.slice(chunked.chunkSize);

        const expectedHash = chunkHashes[currentIndex];
        const valid = await verifyChunk(chunk, expectedHash, algorithm);

        bytesProcessed += chunk.length;

        const result: ChunkVerificationResult = {
          index: currentIndex,
          valid,
          expectedHash,
          chunk,
        };

        currentIndex++;

        // Return immediately on this chunk (valid or not)
        // Caller can call again to process next chunk
        return result;
      }

      // Check if this is the last chunk and we have enough data
      // For the last chunk, we accept any remaining data
      if (currentIndex === chunkHashes.length - 1 && buffer.length > 0) {
        // For the last chunk, we need to know when all data has arrived
        // This is tricky without knowing total size, so we verify what we have
        const expectedHash = chunkHashes[currentIndex];
        const valid = await verifyChunk(buffer, expectedHash, algorithm);

        bytesProcessed += buffer.length;

        const result: ChunkVerificationResult = {
          index: currentIndex,
          valid,
          expectedHash,
          chunk: buffer,
        };

        currentIndex++;
        buffer = new Uint8Array(0);

        return result;
      }

      // No complete chunk yet, return partial status
      return {
        index: -1,
        valid: true,
        expectedHash: '' as SRIString,
        partial: true,
      };
    },

    async finalize(): Promise<void> {
      if (currentIndex !== chunkHashes.length) {
        throw new Error(
          `Incomplete data: expected ${chunkHashes.length} chunks, got ${currentIndex}`
        );
      }

      if (buffer.length > 0) {
        throw new Error(`Unexpected data remaining: ${buffer.length} bytes`);
      }
    },
  };
}

/**
 * Chunk verifier interface
 */
export interface ChunkedVerifier {
  readonly currentChunkIndex: number;
  readonly totalChunks: number;
  readonly bytesProcessed: number;
  verifyNextChunk(data: Uint8Array): Promise<ChunkVerificationResult>;
  finalize(): Promise<void>;
}

/**
 * Result of verifying a single chunk
 */
export interface ChunkVerificationResult {
  /** Chunk index (0-based), -1 if partial */
  index: number;
  /** Whether the chunk passed verification */
  valid: boolean;
  /** Expected hash for this chunk */
  expectedHash: SRIString;
  /** The chunk data (only present for complete chunks) */
  chunk?: Uint8Array;
  /** True if we don't have a complete chunk yet */
  partial?: boolean;
}

// ============ Internal helpers ============

/**
 * Split data into chunks of specified size
 */
function splitIntoChunks(data: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < data.length) {
    const end = Math.min(offset + chunkSize, data.length);
    chunks.push(data.slice(offset, end));
    offset = end;
  }

  return chunks;
}

/**
 * Hash a single chunk
 */
async function hashChunk(
  chunk: Uint8Array,
  algorithm: HashAlgorithm
): Promise<SRIString> {
  const hasher = await createHasher(algorithm);
  hasher.update(chunk);
  return await hasher.finalize();
}

/**
 * Compute root hash from chunk hashes
 *
 * This uses simple concatenation + hash, NOT a hierarchical Merkle tree.
 * The root serves as a quick check that the chunk list wasn't modified,
 * but doesn't provide proof-of-inclusion for individual chunks.
 */
async function computeRootHash(
  chunkHashes: SRIString[],
  algorithm: HashAlgorithm
): Promise<SRIString> {
  if (chunkHashes.length === 0) {
    throw new Error('Cannot compute root hash of empty chunk list');
  }

  if (chunkHashes.length === 1) {
    return chunkHashes[0];
  }

  // Concatenate all chunk hashes and hash the result
  const encoder = new TextEncoder();
  const concatenated = chunkHashes.join('');
  const data = encoder.encode(concatenated);

  const hasher = await createHasher(algorithm);
  hasher.update(data);
  return await hasher.finalize();
}

/**
 * Parse hash algorithm from SRI string
 */
function parseAlgorithmFromSri(sri: SRIString): HashAlgorithm {
  if (sri.startsWith('sha256-')) return 'sha256';
  if (sri.startsWith('sha384-')) return 'sha384';
  if (sri.startsWith('sha512-')) return 'sha512';
  throw new Error(`Unknown algorithm in SRI: ${sri}`);
}

