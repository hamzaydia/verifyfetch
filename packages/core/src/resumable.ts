/**
 * Resumable Downloads with Chunked Verification
 *
 * The killer feature: download 4GB, fail at 3.8GB, resume from 3.8GB.
 * No more starting over.
 */

import type { ChunkedInfo, SRIString } from './types.js';
import { createChunkedVerifier } from './chunked.js';
import {
  saveDownloadState,
  loadDownloadState,
  deleteDownloadState,
  saveChunk,
  loadChunks,
  isStorageAvailable,
  type DownloadState,
} from './storage.js';

/**
 * Options for resumable fetch
 */
export interface ResumableFetchOptions {
  /**
   * Chunked verification config (required for resumable downloads)
   */
  chunked: ChunkedInfo;

  /**
   * Enable persistence to IndexedDB for resume after page reload
   * @default true
   */
  persist?: boolean;

  /**
   * Progress callback
   */
  onProgress?: (progress: ResumableProgress) => void;

  /**
   * Called when resuming from a previous download
   */
  onResume?: (state: DownloadState) => void;

  /**
   * Custom fetch implementation
   */
  fetchImpl?: typeof fetch;

  /**
   * Timeout per chunk request in ms
   * @default 30000
   */
  chunkTimeout?: number;
}

/**
 * Progress information for resumable downloads
 */
export interface ResumableProgress {
  /** Bytes downloaded and verified */
  bytesVerified: number;

  /** Total bytes (from Content-Length) */
  totalBytes?: number;

  /** Number of verified chunks */
  chunksVerified: number;

  /** Total number of chunks */
  totalChunks: number;

  /** Whether this is a resumed download */
  resumed: boolean;

  /** Download speed in bytes/second (rolling average) */
  speed: number;

  /** Estimated time remaining in ms */
  eta?: number;
}

/**
 * Result of a resumable fetch
 */
export interface ResumableFetchResult {
  /** The verified response data */
  data: ArrayBuffer;

  /** Whether the download was resumed */
  resumed: boolean;

  /** Number of chunks that were already verified (from resume) */
  chunksResumed: number;

  /** Total chunks downloaded */
  totalChunks: number;

  /** Total bytes */
  totalBytes: number;
}

/**
 * Fetch a file with resumable, chunked verification
 *
 * If the download fails or the page reloads, calling this again
 * with the same URL will resume from the last verified chunk.
 *
 * @example
 * ```ts
 * const result = await verifyFetchResumable('/model.safetensors', {
 *   chunked: manifest.artifacts['/model.safetensors'].chunked,
 *   onProgress: ({ bytesVerified, totalBytes, chunksVerified, totalChunks }) => {
 *     console.log(`${chunksVerified}/${totalChunks} chunks verified`);
 *   }
 * });
 *
 * // If page reloads or network fails, call again to resume:
 * const result2 = await verifyFetchResumable('/model.safetensors', {
 *   chunked: manifest.artifacts['/model.safetensors'].chunked,
 *   onResume: (state) => {
 *     console.log(`Resuming from chunk ${state.verifiedChunks}`);
 *   }
 * });
 * ```
 */
export async function verifyFetchResumable(
  url: string | URL,
  options: ResumableFetchOptions
): Promise<ResumableFetchResult> {
  const {
    chunked,
    persist = true,
    onProgress,
    onResume,
    fetchImpl = fetch,
    chunkTimeout = 30000,
  } = options;

  const urlString = url.toString();
  const totalChunks = chunked.hashes?.length || 0;

  if (totalChunks === 0) {
    throw new Error('Chunked config has no hashes');
  }

  // Check for existing download state
  let existingState: DownloadState | null = null;
  let existingChunks = new Map<number, ArrayBuffer>();
  let resumed = false;
  let chunksResumed = 0;

  if (persist && isStorageAvailable()) {
    existingState = await loadDownloadState(urlString);

    if (existingState) {
      // Validate that the chunked config matches
      const existingHashes = existingState.chunked.hashes || [];
      const currentHashes = chunked.hashes || [];

      if (existingHashes.length === currentHashes.length &&
          existingState.chunked.root === chunked.root) {
        // Config matches, we can resume
        existingChunks = await loadChunks(urlString);
        chunksResumed = existingState.verifiedChunks;
        resumed = true;

        if (onResume) {
          onResume(existingState);
        }
      } else {
        // Config changed, start fresh
        await deleteDownloadState(urlString);
        existingState = null;
      }
    }
  }

  // Initialize state
  const state: DownloadState = existingState || {
    url: urlString,
    chunked,
    verifiedChunks: 0,
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    bytesVerified: 0,
  };

  // Collect all chunks (existing + new)
  const allChunks: ArrayBuffer[] = new Array(totalChunks);

  // Copy existing verified chunks
  for (const [index, data] of existingChunks) {
    allChunks[index] = data;
  }

  // Speed tracking
  let lastProgressTime = Date.now();
  let lastProgressBytes = state.bytesVerified;
  let speedSamples: number[] = [];

  const reportProgress = () => {
    if (!onProgress) return;

    const now = Date.now();
    const timeDiff = (now - lastProgressTime) / 1000;
    const bytesDiff = state.bytesVerified - lastProgressBytes;

    if (timeDiff > 0) {
      const currentSpeed = bytesDiff / timeDiff;
      speedSamples.push(currentSpeed);
      if (speedSamples.length > 10) speedSamples.shift();
    }

    const avgSpeed = speedSamples.length > 0
      ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
      : 0;

    const remainingBytes = (state.totalSize || 0) - state.bytesVerified;
    const eta = avgSpeed > 0 ? (remainingBytes / avgSpeed) * 1000 : undefined;

    lastProgressTime = now;
    lastProgressBytes = state.bytesVerified;

    onProgress({
      bytesVerified: state.bytesVerified,
      totalBytes: state.totalSize,
      chunksVerified: state.verifiedChunks,
      totalChunks,
      resumed,
      speed: avgSpeed,
      eta,
    });
  };

  // Download and verify remaining chunks
  const startChunk = state.verifiedChunks;
  const chunkHashes = chunked.hashes || [];

  for (let i = startChunk; i < totalChunks; i++) {
    const rangeStart = i * chunked.chunkSize;
    const rangeEnd = Math.min((i + 1) * chunked.chunkSize - 1, (state.totalSize || Infinity) - 1);

    // Fetch this chunk with Range header
    const response = await fetchWithTimeout(
      urlString,
      {
        headers: {
          Range: `bytes=${rangeStart}-${rangeEnd}`,
        },
      },
      chunkTimeout,
      fetchImpl
    );

    // Get total size from first response
    if (i === startChunk && !state.totalSize) {
      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          state.totalSize = parseInt(match[1], 10);
        }
      }
    }

    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to fetch chunk ${i}: ${response.status} ${response.statusText}`);
    }

    const chunkData = await response.arrayBuffer();

    // Verify chunk
    const expectedHash = chunkHashes[i];
    const actualHash = await hashChunk(new Uint8Array(chunkData));

    if (actualHash !== expectedHash) {
      throw new ChunkVerificationError(
        urlString,
        i,
        expectedHash,
        actualHash,
        state.bytesVerified,
        state.totalSize
      );
    }

    // Chunk verified - store it
    allChunks[i] = chunkData;
    state.verifiedChunks = i + 1;
    state.bytesVerified += chunkData.byteLength;
    state.lastUpdated = Date.now();

    // Persist progress
    if (persist && isStorageAvailable()) {
      await saveChunk(urlString, i, chunkData);
      await saveDownloadState(state);
    }

    reportProgress();
  }

  // All chunks verified - concatenate and clean up
  const totalBytes = allChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of allChunks) {
    result.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  // Clean up storage
  if (persist && isStorageAvailable()) {
    await deleteDownloadState(urlString);
  }

  return {
    data: result.buffer as ArrayBuffer,
    resumed,
    chunksResumed,
    totalChunks,
    totalBytes,
  };
}

/**
 * Error thrown when a chunk fails verification
 */
export class ChunkVerificationError extends Error {
  constructor(
    public readonly url: string,
    public readonly chunkIndex: number,
    public readonly expectedHash: SRIString,
    public readonly actualHash: SRIString,
    public readonly bytesVerified: number,
    public readonly totalBytes?: number
  ) {
    const progress = totalBytes
      ? ` (${Math.round(bytesVerified / totalBytes * 100)}% complete)`
      : '';

    super(
      `Chunk ${chunkIndex} verification failed for ${url}${progress}\n` +
      `  Expected: ${expectedHash}\n` +
      `  Actual:   ${actualHash}\n\n` +
      `This could indicate:\n` +
      `  - File corruption during transfer\n` +
      `  - CDN serving wrong content\n` +
      `  - Potential tampering\n\n` +
      `The download can be retried - verified chunks are preserved.`
    );
    this.name = 'ChunkVerificationError';
  }
}

/**
 * Check if a download can be resumed
 */
export async function canResume(url: string): Promise<boolean> {
  if (!isStorageAvailable()) return false;

  const state = await loadDownloadState(url);
  return state !== null && state.verifiedChunks > 0;
}

/**
 * Get progress of an in-progress or paused download
 */
export async function getDownloadProgress(url: string): Promise<{
  chunksVerified: number;
  totalChunks: number;
  bytesVerified: number;
  totalBytes?: number;
  startedAt: number;
  lastUpdated: number;
} | null> {
  if (!isStorageAvailable()) return null;

  const state = await loadDownloadState(url);
  if (!state) return null;

  const totalChunks = state.chunked.hashes?.length || 0;

  return {
    chunksVerified: state.verifiedChunks,
    totalChunks,
    bytesVerified: state.bytesVerified,
    totalBytes: state.totalSize,
    startedAt: state.startedAt,
    lastUpdated: state.lastUpdated,
  };
}

/**
 * Cancel and clear a download
 */
export async function cancelDownload(url: string): Promise<void> {
  if (!isStorageAvailable()) return;
  await deleteDownloadState(url);
}

// ============ Internal helpers ============

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number,
  fetchImpl: typeof fetch
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Hash a chunk using SubtleCrypto (fast enough for small chunks)
 */
async function hashChunk(data: Uint8Array): Promise<SRIString> {
  // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `sha256-${hashBase64}` as SRIString;
}
