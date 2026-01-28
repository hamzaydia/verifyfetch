/**
 * Comprehensive Tests for Resumable Downloads
 *
 * Tests the "killer feature" - download 4GB, fail at 3.8GB, resume from 3.8GB.
 * These tests verify real verification logic, not just mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ChunkedInfo, SRIString } from './types.js';

// Mock IndexedDB before importing modules
import 'fake-indexeddb/auto';

import {
  verifyFetchResumable,
  canResume,
  getDownloadProgress,
  cancelDownload,
  ChunkVerificationError,
  type ResumableFetchOptions,
  type ResumableProgress,
} from './resumable.js';

import {
  saveDownloadState,
  loadDownloadState,
  saveChunk,
  loadChunks,
  deleteDownloadState,
  type DownloadState,
} from './storage.js';

// Helper to compute real SHA-256 hash (same as in resumable.ts)
async function computeHash(data: Uint8Array): Promise<SRIString> {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `sha256-${hashBase64}` as SRIString;
}

// Helper to create real chunked info with correct hashes
async function createRealChunkedInfo(
  chunks: Uint8Array[]
): Promise<{ chunked: ChunkedInfo; fullData: Uint8Array }> {
  const hashes: SRIString[] = [];
  let totalSize = 0;

  for (const chunk of chunks) {
    hashes.push(await computeHash(chunk));
    totalSize += chunk.length;
  }

  // Compute root hash from concatenated hashes
  const concatenated = hashes.join('');
  const rootData = new TextEncoder().encode(concatenated);
  const root = await computeHash(rootData);

  // Concatenate all chunks into full data
  const fullData = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    fullData.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    chunked: {
      root,
      chunkSize: chunks[0]?.length || 100,
      hashes,
    },
    fullData,
  };
}

// Helper to create mock fetch that returns Range responses
function createChunkedFetchMock(fullData: Uint8Array, totalSize?: number) {
  const size = totalSize ?? fullData.length;

  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const rangeHeader = init?.headers instanceof Headers
      ? init.headers.get('Range')
      : (init?.headers as Record<string, string>)?.['Range'];

    if (!rangeHeader) {
      // Full response
      return new Response(fullData.buffer, {
        status: 200,
        headers: { 'Content-Length': String(size) },
      });
    }

    // Parse Range header: "bytes=start-end"
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new Response('Invalid Range', { status: 400 });
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : size - 1;

    const chunkData = fullData.slice(start, end + 1);

    return new Response(chunkData.buffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkData.length),
      },
    });
  });
}

describe('Resumable Downloads', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Clean up any leftover state
    try {
      await deleteDownloadState('https://example.com/test.bin');
      await deleteDownloadState('https://example.com/resume.bin');
      await deleteDownloadState('https://example.com/progress.bin');
    } catch {
      // Ignore errors from non-existent state
    }
  });

  describe('verifyFetchResumable', () => {
    describe('successful downloads', () => {
      it('should download and verify a file with correct hashes', async () => {
        const chunks = [
          new Uint8Array([1, 2, 3, 4, 5]),
          new Uint8Array([6, 7, 8, 9, 10]),
          new Uint8Array([11, 12, 13, 14, 15]),
        ];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);

        const result = await verifyFetchResumable('https://example.com/test.bin', {
          chunked,
          fetchImpl: mockFetch,
          persist: false,
        });

        expect(result.data.byteLength).toBe(15);
        expect(new Uint8Array(result.data)).toEqual(fullData);
        expect(result.totalChunks).toBe(3);
        expect(result.resumed).toBe(false);
        expect(result.chunksResumed).toBe(0);
      });

      it('should download a single-chunk file', async () => {
        const chunks = [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);

        const result = await verifyFetchResumable('https://example.com/test.bin', {
          chunked,
          fetchImpl: mockFetch,
          persist: false,
        });

        expect(result.data.byteLength).toBe(10);
        expect(result.totalChunks).toBe(1);
      });

      it('should handle many chunks', async () => {
        const chunks = Array.from({ length: 20 }, (_, i) =>
          new Uint8Array(Array.from({ length: 100 }, (_, j) => (i * 100 + j) % 256))
        );
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);

        const result = await verifyFetchResumable('https://example.com/test.bin', {
          chunked,
          fetchImpl: mockFetch,
          persist: false,
        });

        expect(result.totalChunks).toBe(20);
        expect(result.data.byteLength).toBe(2000);
      });
    });

    describe('progress tracking', () => {
      it('should call onProgress callback', async () => {
        const chunks = [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
        ];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);
        const progressCalls: ResumableProgress[] = [];

        await verifyFetchResumable('https://example.com/progress.bin', {
          chunked,
          fetchImpl: mockFetch,
          persist: false,
          onProgress: (progress) => progressCalls.push({ ...progress }),
        });

        expect(progressCalls.length).toBeGreaterThan(0);

        // Final progress should show all chunks verified
        const finalProgress = progressCalls[progressCalls.length - 1];
        expect(finalProgress.chunksVerified).toBe(3);
        expect(finalProgress.bytesVerified).toBe(9);
        expect(finalProgress.totalChunks).toBe(3);
        expect(finalProgress.resumed).toBe(false);
      });

      it('should report incremental progress', async () => {
        const chunks = [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
        ];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);
        const chunksVerifiedSequence: number[] = [];

        await verifyFetchResumable('https://example.com/progress.bin', {
          chunked,
          fetchImpl: mockFetch,
          persist: false,
          onProgress: (progress) => chunksVerifiedSequence.push(progress.chunksVerified),
        });

        // Should see 1, 2, 3 (incremental)
        expect(chunksVerifiedSequence).toContain(1);
        expect(chunksVerifiedSequence).toContain(2);
        expect(chunksVerifiedSequence).toContain(3);
      });
    });

    describe('verification failure', () => {
      it('should throw ChunkVerificationError on corrupted chunk', async () => {
        const chunks = [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
        ];
        const { chunked } = await createRealChunkedInfo(chunks);

        // Corrupt the second chunk in the response
        const corruptedData = new Uint8Array([1, 2, 3, 99, 99, 99, 7, 8, 9]);
        const mockFetch = createChunkedFetchMock(corruptedData);

        await expect(
          verifyFetchResumable('https://example.com/test.bin', {
            chunked,
            fetchImpl: mockFetch,
            persist: false,
          })
        ).rejects.toThrow(ChunkVerificationError);
      });

      it('should include chunk index in error', async () => {
        const chunks = [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
        ];
        const { chunked } = await createRealChunkedInfo(chunks);

        // Corrupt chunk 1 (second chunk)
        const corruptedData = new Uint8Array([1, 2, 3, 99, 99, 99, 7, 8, 9]);
        const mockFetch = createChunkedFetchMock(corruptedData);

        try {
          await verifyFetchResumable('https://example.com/test.bin', {
            chunked,
            fetchImpl: mockFetch,
            persist: false,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ChunkVerificationError);
          const chunkError = error as ChunkVerificationError;
          expect(chunkError.chunkIndex).toBe(1);
          expect(chunkError.url).toBe('https://example.com/test.bin');
        }
      });

      it('should detect single bit flip', async () => {
        const chunks = [new Uint8Array([0b10101010])];
        const { chunked } = await createRealChunkedInfo(chunks);

        // Flip one bit
        const corrupted = new Uint8Array([0b10101011]);
        const mockFetch = createChunkedFetchMock(corrupted);

        await expect(
          verifyFetchResumable('https://example.com/test.bin', {
            chunked,
            fetchImpl: mockFetch,
            persist: false,
          })
        ).rejects.toThrow(ChunkVerificationError);
      });
    });

    describe('error handling', () => {
      it('should throw if chunked config has no hashes', async () => {
        const chunked: ChunkedInfo = {
          root: 'sha256-empty=' as SRIString,
          chunkSize: 100,
          hashes: [],
        };

        await expect(
          verifyFetchResumable('https://example.com/test.bin', {
            chunked,
            fetchImpl: vi.fn(),
            persist: false,
          })
        ).rejects.toThrow('Chunked config has no hashes');
      });

      it('should throw on fetch failure', async () => {
        const chunks = [new Uint8Array([1, 2, 3])];
        const { chunked } = await createRealChunkedInfo(chunks);

        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

        await expect(
          verifyFetchResumable('https://example.com/test.bin', {
            chunked,
            fetchImpl: mockFetch,
            persist: false,
          })
        ).rejects.toThrow('Network error');
      });

      it('should throw on HTTP error response', async () => {
        const chunks = [new Uint8Array([1, 2, 3])];
        const { chunked } = await createRealChunkedInfo(chunks);

        const mockFetch = vi.fn().mockResolvedValue(
          new Response('Not Found', { status: 404, statusText: 'Not Found' })
        );

        await expect(
          verifyFetchResumable('https://example.com/test.bin', {
            chunked,
            fetchImpl: mockFetch,
            persist: false,
          })
        ).rejects.toThrow('Failed to fetch chunk');
      });
    });

    describe('resume functionality', () => {
      it('should resume from previously verified chunks', async () => {
        const url = 'https://example.com/resume.bin';
        const chunks = [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
        ];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        // Simulate partial download - 2 chunks already verified
        const existingState: DownloadState = {
          url,
          chunked,
          verifiedChunks: 2,
          bytesVerified: 6,
          startedAt: Date.now() - 10000,
          lastUpdated: Date.now() - 5000,
        };

        await saveDownloadState(existingState);
        await saveChunk(url, 0, chunks[0].buffer);
        await saveChunk(url, 1, chunks[1].buffer);

        const mockFetch = createChunkedFetchMock(fullData);
        let resumeCalled = false;

        const result = await verifyFetchResumable(url, {
          chunked,
          fetchImpl: mockFetch,
          persist: true,
          onResume: () => { resumeCalled = true; },
        });

        expect(resumeCalled).toBe(true);
        expect(result.resumed).toBe(true);
        expect(result.chunksResumed).toBe(2);

        // Should only have fetched the third chunk
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchCall = mockFetch.mock.calls[0];
        const rangeHeader = fetchCall[1]?.headers?.['Range'] || fetchCall[1]?.headers?.get?.('Range');
        expect(rangeHeader).toContain('bytes=6-'); // Start from byte 6

        // Final result should have all data
        expect(new Uint8Array(result.data)).toEqual(fullData);
      });

      it('should start fresh if chunked config changed', async () => {
        const url = 'https://example.com/resume.bin';

        // Old config with different hashes
        const oldChunked: ChunkedInfo = {
          root: 'sha256-oldRoot=' as SRIString,
          chunkSize: 100,
          hashes: ['sha256-oldHash1=' as SRIString, 'sha256-oldHash2=' as SRIString],
        };

        await saveDownloadState({
          url,
          chunked: oldChunked,
          verifiedChunks: 1,
          bytesVerified: 100,
          startedAt: Date.now(),
          lastUpdated: Date.now(),
        });

        // New download with different config
        const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
        const { chunked: newChunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);

        const result = await verifyFetchResumable(url, {
          chunked: newChunked,
          fetchImpl: mockFetch,
          persist: true,
        });

        // Should NOT have resumed (config changed)
        expect(result.resumed).toBe(false);
        expect(result.chunksResumed).toBe(0);

        // Should have fetched all chunks
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should clean up storage after successful download', async () => {
        const url = 'https://example.com/cleanup.bin';
        const chunks = [new Uint8Array([1, 2, 3])];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);

        await verifyFetchResumable(url, {
          chunked,
          fetchImpl: mockFetch,
          persist: true,
        });

        // Storage should be cleaned up
        const state = await loadDownloadState(url);
        expect(state).toBeNull();

        const storedChunks = await loadChunks(url);
        expect(storedChunks.size).toBe(0);
      });
    });

    describe('persistence', () => {
      it('should save progress during download when persist=true', async () => {
        const url = 'https://example.com/persist.bin';
        const chunks = [
          new Uint8Array([1, 2, 3]),
          new Uint8Array([4, 5, 6]),
          new Uint8Array([7, 8, 9]),
        ];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        let fetchCount = 0;
        const mockFetch = vi.fn().mockImplementation(async (fetchUrl: string, init?: RequestInit) => {
          fetchCount++;

          // After first chunk, check that progress is saved
          if (fetchCount === 2) {
            const savedState = await loadDownloadState(url);
            expect(savedState).not.toBeNull();
            expect(savedState!.verifiedChunks).toBe(1);
          }

          return createChunkedFetchMock(fullData)(fetchUrl, init);
        });

        await verifyFetchResumable(url, {
          chunked,
          fetchImpl: mockFetch,
          persist: true,
        });
      });

      it('should not save progress when persist=false', async () => {
        const url = 'https://example.com/no-persist.bin';
        const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
        const { chunked, fullData } = await createRealChunkedInfo(chunks);

        const mockFetch = createChunkedFetchMock(fullData);

        await verifyFetchResumable(url, {
          chunked,
          fetchImpl: mockFetch,
          persist: false,
        });

        const state = await loadDownloadState(url);
        expect(state).toBeNull();
      });
    });
  });

  describe('canResume', () => {
    it('should return true when download state exists with verified chunks', async () => {
      const url = 'https://example.com/can-resume.bin';

      await saveDownloadState({
        url,
        chunked: {
          root: 'sha256-test=' as SRIString,
          chunkSize: 100,
          hashes: ['sha256-h1=' as SRIString, 'sha256-h2=' as SRIString],
        },
        verifiedChunks: 1,
        bytesVerified: 100,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      expect(await canResume(url)).toBe(true);
    });

    it('should return false when no download state exists', async () => {
      expect(await canResume('https://nonexistent.com/file.bin')).toBe(false);
    });

    it('should return false when verifiedChunks is 0', async () => {
      const url = 'https://example.com/zero-chunks.bin';

      await saveDownloadState({
        url,
        chunked: {
          root: 'sha256-test=' as SRIString,
          chunkSize: 100,
          hashes: ['sha256-h1=' as SRIString],
        },
        verifiedChunks: 0,
        bytesVerified: 0,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      expect(await canResume(url)).toBe(false);
    });
  });

  describe('getDownloadProgress', () => {
    it('should return progress info for existing download', async () => {
      const url = 'https://example.com/get-progress.bin';

      await saveDownloadState({
        url,
        chunked: {
          root: 'sha256-test=' as SRIString,
          chunkSize: 1000,
          hashes: ['sha256-h1=' as SRIString, 'sha256-h2=' as SRIString, 'sha256-h3=' as SRIString],
        },
        verifiedChunks: 2,
        bytesVerified: 2000,
        totalSize: 3000,
        startedAt: 1000,
        lastUpdated: 2000,
      });

      const progress = await getDownloadProgress(url);

      expect(progress).not.toBeNull();
      expect(progress!.chunksVerified).toBe(2);
      expect(progress!.totalChunks).toBe(3);
      expect(progress!.bytesVerified).toBe(2000);
      expect(progress!.totalBytes).toBe(3000);
      expect(progress!.startedAt).toBe(1000);
      expect(progress!.lastUpdated).toBe(2000);
    });

    it('should return null for non-existent download', async () => {
      const progress = await getDownloadProgress('https://nonexistent.com/file.bin');
      expect(progress).toBeNull();
    });
  });

  describe('cancelDownload', () => {
    it('should remove download state and chunks', async () => {
      const url = 'https://example.com/cancel.bin';

      await saveDownloadState({
        url,
        chunked: {
          root: 'sha256-test=' as SRIString,
          chunkSize: 100,
          hashes: ['sha256-h1=' as SRIString],
        },
        verifiedChunks: 1,
        bytesVerified: 100,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });
      await saveChunk(url, 0, new ArrayBuffer(100));

      await cancelDownload(url);

      expect(await loadDownloadState(url)).toBeNull();
      expect((await loadChunks(url)).size).toBe(0);
    });

    it('should not throw for non-existent download', async () => {
      await expect(cancelDownload('https://nonexistent.com/file.bin')).resolves.toBeUndefined();
    });
  });

  describe('ChunkVerificationError', () => {
    it('should contain useful error information', () => {
      const error = new ChunkVerificationError(
        'https://example.com/file.bin',
        5,
        'sha256-expected=' as SRIString,
        'sha256-actual=' as SRIString,
        5000,
        10000
      );

      expect(error.name).toBe('ChunkVerificationError');
      expect(error.url).toBe('https://example.com/file.bin');
      expect(error.chunkIndex).toBe(5);
      expect(error.expectedHash).toBe('sha256-expected=');
      expect(error.actualHash).toBe('sha256-actual=');
      expect(error.bytesVerified).toBe(5000);
      expect(error.totalBytes).toBe(10000);
      expect(error.message).toContain('Chunk 5');
      expect(error.message).toContain('50%'); // 5000/10000 = 50%
    });

    it('should handle undefined totalBytes', () => {
      const error = new ChunkVerificationError(
        'https://example.com/file.bin',
        3,
        'sha256-expected=' as SRIString,
        'sha256-actual=' as SRIString,
        3000,
        undefined
      );

      expect(error.message).toContain('Chunk 3');
      expect(error.message).not.toContain('%'); // No percentage without total
    });
  });

  describe('edge cases', () => {
    it('should handle URL with special characters', async () => {
      const url = 'https://example.com/path/file%20name.bin?v=1';
      const chunks = [new Uint8Array([1, 2, 3])];
      const { chunked, fullData } = await createRealChunkedInfo(chunks);

      const mockFetch = createChunkedFetchMock(fullData);

      const result = await verifyFetchResumable(url, {
        chunked,
        fetchImpl: mockFetch,
        persist: false,
      });

      expect(result.data.byteLength).toBe(3);
    });

    it('should handle URL object input', async () => {
      const url = new URL('https://example.com/url-object.bin');
      const chunks = [new Uint8Array([1, 2, 3])];
      const { chunked, fullData } = await createRealChunkedInfo(chunks);

      const mockFetch = createChunkedFetchMock(fullData);

      const result = await verifyFetchResumable(url, {
        chunked,
        fetchImpl: mockFetch,
        persist: false,
      });

      expect(result.data.byteLength).toBe(3);
    });

    it('should handle binary data with all byte values', async () => {
      const data = new Uint8Array(256);
      for (let i = 0; i < 256; i++) data[i] = i;

      const { chunked, fullData } = await createRealChunkedInfo([data]);
      const mockFetch = createChunkedFetchMock(fullData);

      const result = await verifyFetchResumable('https://example.com/all-bytes.bin', {
        chunked,
        fetchImpl: mockFetch,
        persist: false,
      });

      expect(new Uint8Array(result.data)).toEqual(data);
    });
  });
});
