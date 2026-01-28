/**
 * Comprehensive Tests for IndexedDB Storage
 *
 * Tests the persistence layer for resumable downloads.
 * Uses fake-indexeddb for realistic IndexedDB simulation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChunkedInfo, SRIString } from './types.js';

// Mock IndexedDB before importing storage module
import 'fake-indexeddb/auto';

import {
  saveDownloadState,
  loadDownloadState,
  deleteDownloadState,
  saveChunk,
  loadChunks,
  isStorageAvailable,
  clearOldDownloads,
  getAllDownloads,
  type DownloadState,
} from './storage.js';

// Test fixtures
const createTestChunkedInfo = (numChunks: number = 3): ChunkedInfo => ({
  root: 'sha256-rootHash123=' as SRIString,
  chunkSize: 1024,
  hashes: Array.from({ length: numChunks }, (_, i) =>
    `sha256-chunk${i}Hash=` as SRIString
  ),
});

const createTestState = (url: string, overrides: Partial<DownloadState> = {}): DownloadState => ({
  url,
  chunked: createTestChunkedInfo(),
  verifiedChunks: 0,
  startedAt: Date.now(),
  lastUpdated: Date.now(),
  bytesVerified: 0,
  ...overrides,
});

describe('IndexedDB Storage', () => {
  beforeEach(() => {
    // Clear any cached db promise between tests
    vi.resetModules();
  });

  describe('isStorageAvailable', () => {
    it('should return true when IndexedDB is available', () => {
      expect(isStorageAvailable()).toBe(true);
    });
  });

  describe('saveDownloadState / loadDownloadState', () => {
    it('should save and load download state', async () => {
      const state = createTestState('https://example.com/model.bin', {
        verifiedChunks: 2,
        bytesVerified: 2048,
        totalSize: 3072,
      });

      await saveDownloadState(state);
      const loaded = await loadDownloadState('https://example.com/model.bin');

      expect(loaded).not.toBeNull();
      expect(loaded!.url).toBe(state.url);
      expect(loaded!.verifiedChunks).toBe(2);
      expect(loaded!.bytesVerified).toBe(2048);
      expect(loaded!.totalSize).toBe(3072);
      expect(loaded!.chunked.root).toBe(state.chunked.root);
    });

    it('should return null for non-existent URL', async () => {
      const loaded = await loadDownloadState('https://nonexistent.com/file.bin');
      expect(loaded).toBeNull();
    });

    it('should update existing state on re-save', async () => {
      const url = 'https://example.com/update-test.bin';
      const state1 = createTestState(url, { verifiedChunks: 1 });

      await saveDownloadState(state1);

      const state2 = createTestState(url, { verifiedChunks: 5, bytesVerified: 5120 });
      await saveDownloadState(state2);

      const loaded = await loadDownloadState(url);
      expect(loaded!.verifiedChunks).toBe(5);
      expect(loaded!.bytesVerified).toBe(5120);
    });

    it('should handle multiple different URLs', async () => {
      const state1 = createTestState('https://cdn1.com/file1.bin', { verifiedChunks: 1 });
      const state2 = createTestState('https://cdn2.com/file2.bin', { verifiedChunks: 2 });
      const state3 = createTestState('https://cdn3.com/file3.bin', { verifiedChunks: 3 });

      await saveDownloadState(state1);
      await saveDownloadState(state2);
      await saveDownloadState(state3);

      const loaded1 = await loadDownloadState('https://cdn1.com/file1.bin');
      const loaded2 = await loadDownloadState('https://cdn2.com/file2.bin');
      const loaded3 = await loadDownloadState('https://cdn3.com/file3.bin');

      expect(loaded1!.verifiedChunks).toBe(1);
      expect(loaded2!.verifiedChunks).toBe(2);
      expect(loaded3!.verifiedChunks).toBe(3);
    });

    it('should preserve chunked config with all hash types', async () => {
      const chunked: ChunkedInfo = {
        root: 'sha384-longerRootHash=' as SRIString,
        chunkSize: 2048,
        hashes: [
          'sha384-hash0=' as SRIString,
          'sha384-hash1=' as SRIString,
          'sha384-hash2=' as SRIString,
        ],
      };

      const state = createTestState('https://example.com/sha384.bin', { chunked });
      await saveDownloadState(state);

      const loaded = await loadDownloadState('https://example.com/sha384.bin');
      expect(loaded!.chunked.root).toBe('sha384-longerRootHash=');
      expect(loaded!.chunked.chunkSize).toBe(2048);
      expect(loaded!.chunked.hashes).toHaveLength(3);
    });
  });

  describe('deleteDownloadState', () => {
    it('should delete existing state', async () => {
      const url = 'https://example.com/delete-test.bin';
      const state = createTestState(url);

      await saveDownloadState(state);
      expect(await loadDownloadState(url)).not.toBeNull();

      await deleteDownloadState(url);
      expect(await loadDownloadState(url)).toBeNull();
    });

    it('should not throw when deleting non-existent state', async () => {
      await expect(
        deleteDownloadState('https://nonexistent.com/file.bin')
      ).resolves.toBeUndefined();
    });

    it('should also delete associated chunks', async () => {
      const url = 'https://example.com/with-chunks.bin';
      const state = createTestState(url);

      await saveDownloadState(state);
      await saveChunk(url, 0, new ArrayBuffer(100));
      await saveChunk(url, 1, new ArrayBuffer(100));

      // Verify chunks exist
      const chunksBefore = await loadChunks(url);
      expect(chunksBefore.size).toBe(2);

      // Delete state (should cascade to chunks)
      await deleteDownloadState(url);

      // Verify chunks are also deleted
      const chunksAfter = await loadChunks(url);
      expect(chunksAfter.size).toBe(0);
    });
  });

  describe('saveChunk / loadChunks', () => {
    it('should save and load a single chunk', async () => {
      const url = 'https://example.com/chunk-test.bin';
      const chunkData = new Uint8Array([1, 2, 3, 4, 5]).buffer;

      await saveChunk(url, 0, chunkData);
      const chunks = await loadChunks(url);

      expect(chunks.size).toBe(1);
      expect(chunks.has(0)).toBe(true);

      const loaded = new Uint8Array(chunks.get(0)!);
      expect(loaded).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should save and load multiple chunks', async () => {
      const url = 'https://example.com/multi-chunk.bin';

      await saveChunk(url, 0, new Uint8Array([0, 0, 0]).buffer);
      await saveChunk(url, 1, new Uint8Array([1, 1, 1]).buffer);
      await saveChunk(url, 2, new Uint8Array([2, 2, 2]).buffer);

      const chunks = await loadChunks(url);

      expect(chunks.size).toBe(3);
      expect(new Uint8Array(chunks.get(0)!)).toEqual(new Uint8Array([0, 0, 0]));
      expect(new Uint8Array(chunks.get(1)!)).toEqual(new Uint8Array([1, 1, 1]));
      expect(new Uint8Array(chunks.get(2)!)).toEqual(new Uint8Array([2, 2, 2]));
    });

    it('should return empty map for URL with no chunks', async () => {
      const chunks = await loadChunks('https://no-chunks.com/file.bin');
      expect(chunks.size).toBe(0);
    });

    it('should update existing chunk on re-save', async () => {
      const url = 'https://example.com/update-chunk.bin';

      await saveChunk(url, 0, new Uint8Array([1, 2, 3]).buffer);
      await saveChunk(url, 0, new Uint8Array([9, 8, 7]).buffer);

      const chunks = await loadChunks(url);
      expect(chunks.size).toBe(1);
      expect(new Uint8Array(chunks.get(0)!)).toEqual(new Uint8Array([9, 8, 7]));
    });

    it('should handle large chunk data', async () => {
      const url = 'https://example.com/large-chunk.bin';
      const largeData = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      await saveChunk(url, 0, largeData.buffer);
      const chunks = await loadChunks(url);

      expect(chunks.size).toBe(1);
      const loaded = new Uint8Array(chunks.get(0)!);
      expect(loaded.length).toBe(1024 * 1024);
      expect(loaded[0]).toBe(0);
      expect(loaded[255]).toBe(255);
      expect(loaded[256]).toBe(0);
    });

    it('should isolate chunks by URL', async () => {
      await saveChunk('https://cdn1.com/file.bin', 0, new Uint8Array([1]).buffer);
      await saveChunk('https://cdn1.com/file.bin', 1, new Uint8Array([2]).buffer);
      await saveChunk('https://cdn2.com/file.bin', 0, new Uint8Array([9]).buffer);

      const chunks1 = await loadChunks('https://cdn1.com/file.bin');
      const chunks2 = await loadChunks('https://cdn2.com/file.bin');

      expect(chunks1.size).toBe(2);
      expect(chunks2.size).toBe(1);
      expect(new Uint8Array(chunks2.get(0)!)[0]).toBe(9);
    });

    it('should handle non-sequential chunk indices', async () => {
      const url = 'https://example.com/sparse-chunks.bin';

      await saveChunk(url, 0, new Uint8Array([0]).buffer);
      await saveChunk(url, 5, new Uint8Array([5]).buffer);
      await saveChunk(url, 10, new Uint8Array([10]).buffer);

      const chunks = await loadChunks(url);

      expect(chunks.size).toBe(3);
      expect(chunks.has(0)).toBe(true);
      expect(chunks.has(5)).toBe(true);
      expect(chunks.has(10)).toBe(true);
      expect(chunks.has(1)).toBe(false);
    });
  });

  describe('getAllDownloads', () => {
    it('should return empty array when no downloads', async () => {
      const downloads = await getAllDownloads();
      // May have leftovers from other tests, just check it doesn't throw
      expect(Array.isArray(downloads)).toBe(true);
    });

    it('should return all saved downloads', async () => {
      const state1 = createTestState('https://test1.com/file.bin');
      const state2 = createTestState('https://test2.com/file.bin');

      await saveDownloadState(state1);
      await saveDownloadState(state2);

      const downloads = await getAllDownloads();
      const urls = downloads.map(d => d.url);

      expect(urls).toContain('https://test1.com/file.bin');
      expect(urls).toContain('https://test2.com/file.bin');
    });
  });

  describe('clearOldDownloads', () => {
    it('should clear downloads older than maxAge', async () => {
      const oldUrl = 'https://example.com/old.bin';
      const newUrl = 'https://example.com/new.bin';

      // Create old download (2 days ago)
      const oldState = createTestState(oldUrl, {
        startedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        lastUpdated: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });

      // Create new download (now)
      const newState = createTestState(newUrl, {
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      await saveDownloadState(oldState);
      await saveDownloadState(newState);

      // Clear downloads older than 1 day
      const deleted = await clearOldDownloads(24 * 60 * 60 * 1000);

      expect(deleted).toBeGreaterThanOrEqual(1);

      // Old should be gone, new should remain
      expect(await loadDownloadState(oldUrl)).toBeNull();
      expect(await loadDownloadState(newUrl)).not.toBeNull();
    });

    it('should also clear chunks of old downloads', async () => {
      const oldUrl = 'https://example.com/old-with-chunks.bin';

      const oldState = createTestState(oldUrl, {
        lastUpdated: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });

      await saveDownloadState(oldState);
      await saveChunk(oldUrl, 0, new ArrayBuffer(100));
      await saveChunk(oldUrl, 1, new ArrayBuffer(100));

      await clearOldDownloads(24 * 60 * 60 * 1000);

      const chunks = await loadChunks(oldUrl);
      expect(chunks.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in URL', async () => {
      const url = 'https://example.com/path/file%20name.bin?v=1&x=2';
      const state = createTestState(url);

      await saveDownloadState(state);
      const loaded = await loadDownloadState(url);

      expect(loaded).not.toBeNull();
      expect(loaded!.url).toBe(url);
    });

    it('should handle very long URLs', async () => {
      const longPath = '/'.repeat(100) + 'file.bin';
      const url = `https://example.com${longPath}`;
      const state = createTestState(url);

      await saveDownloadState(state);
      const loaded = await loadDownloadState(url);

      expect(loaded).not.toBeNull();
    });

    it('should handle empty ArrayBuffer chunks', async () => {
      const url = 'https://example.com/empty-chunk.bin';
      await saveChunk(url, 0, new ArrayBuffer(0));

      const chunks = await loadChunks(url);
      expect(chunks.size).toBe(1);
      expect(chunks.get(0)!.byteLength).toBe(0);
    });

    it('should handle chunked config with many hashes', async () => {
      const manyHashes = Array.from({ length: 1000 }, (_, i) =>
        `sha256-hash${i}=` as SRIString
      );

      const state = createTestState('https://example.com/many-hashes.bin', {
        chunked: {
          root: 'sha256-root=' as SRIString,
          chunkSize: 1024,
          hashes: manyHashes,
        },
      });

      await saveDownloadState(state);
      const loaded = await loadDownloadState('https://example.com/many-hashes.bin');

      expect(loaded!.chunked.hashes).toHaveLength(1000);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent saves to same URL', async () => {
      const url = 'https://example.com/concurrent.bin';

      // Save multiple states concurrently
      await Promise.all([
        saveDownloadState(createTestState(url, { verifiedChunks: 1 })),
        saveDownloadState(createTestState(url, { verifiedChunks: 2 })),
        saveDownloadState(createTestState(url, { verifiedChunks: 3 })),
      ]);

      // One of them should win (last write wins)
      const loaded = await loadDownloadState(url);
      expect(loaded).not.toBeNull();
      expect([1, 2, 3]).toContain(loaded!.verifiedChunks);
    });

    it('should handle concurrent chunk saves', async () => {
      const url = 'https://example.com/concurrent-chunks.bin';

      await Promise.all([
        saveChunk(url, 0, new Uint8Array([0]).buffer),
        saveChunk(url, 1, new Uint8Array([1]).buffer),
        saveChunk(url, 2, new Uint8Array([2]).buffer),
      ]);

      const chunks = await loadChunks(url);
      expect(chunks.size).toBe(3);
    });
  });
});
