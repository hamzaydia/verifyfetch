/**
 * Comprehensive Tests for Chunked Verification
 *
 * These tests ensure production-ready behavior with edge cases,
 * boundary conditions, and error scenarios.
 */

import { describe, it, expect } from 'vitest';
import {
  generateChunkedHashes,
  verifyChunk,
  createChunkedVerifier,
  DEFAULT_CHUNK_SIZE,
} from './chunked.js';
import type { SRIString, ChunkedInfo } from './types.js';

describe('Chunked Verification', () => {
  describe('generateChunkedHashes', () => {
    it('should generate chunk hashes for small data', async () => {
      const data = new TextEncoder().encode('Hello, World!');
      const chunked = await generateChunkedHashes(data);

      expect(chunked.root).toMatch(/^sha256-/);
      expect(chunked.chunkSize).toBe(DEFAULT_CHUNK_SIZE);
      expect(chunked.hashes.length).toBe(1); // Single chunk for small data
      expect(chunked.hashes[0]).toMatch(/^sha256-/);
    });

    it('should generate multiple chunks for large data', async () => {
      // 3MB of data = 3 chunks with 1MB chunk size
      const data = new Uint8Array(3 * 1024 * 1024);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data);

      expect(chunked.hashes.length).toBe(3);
      chunked.hashes.forEach((hash) => {
        expect(hash).toMatch(/^sha256-/);
      });
    });

    it('should use custom chunk size', async () => {
      const data = new Uint8Array(1000); // 1000 bytes
      const chunked = await generateChunkedHashes(data, 300); // 300 byte chunks

      // 1000 / 300 = 4 chunks (334 + 333 + 333 bytes)
      expect(chunked.hashes.length).toBe(4);
    });

    it('should use custom algorithm', async () => {
      const data = new TextEncoder().encode('test');
      const chunked = await generateChunkedHashes(data, DEFAULT_CHUNK_SIZE, 'sha384');

      expect(chunked.root).toMatch(/^sha384-/);
      expect(chunked.hashes[0]).toMatch(/^sha384-/);
    });
  });

  describe('verifyChunk', () => {
    it('should return true for valid chunk', async () => {
      const data = new TextEncoder().encode('Hello, World!');
      const chunked = await generateChunkedHashes(data);

      const isValid = await verifyChunk(data, chunked.hashes[0]);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid chunk', async () => {
      const data = new TextEncoder().encode('Hello, World!');
      const chunked = await generateChunkedHashes(data);

      const tamperedData = new TextEncoder().encode('Goodbye, World!');
      const isValid = await verifyChunk(tamperedData, chunked.hashes[0]);
      expect(isValid).toBe(false);
    });
  });

  describe('createChunkedVerifier', () => {
    it('should verify chunks sequentially', async () => {
      // Create 3 chunks of data
      const chunkSize = 100;
      const data = new Uint8Array(250); // Will create 3 chunks
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      expect(verifier.totalChunks).toBe(3);
      expect(verifier.currentChunkIndex).toBe(0);

      // Feed data chunk by chunk
      const chunk1 = data.slice(0, chunkSize);
      const result1 = await verifier.verifyNextChunk(chunk1);
      expect(result1.valid).toBe(true);
      expect(result1.index).toBe(0);

      const chunk2 = data.slice(chunkSize, chunkSize * 2);
      const result2 = await verifier.verifyNextChunk(chunk2);
      expect(result2.valid).toBe(true);
      expect(result2.index).toBe(1);

      const chunk3 = data.slice(chunkSize * 2);
      const result3 = await verifier.verifyNextChunk(chunk3);
      expect(result3.valid).toBe(true);
      expect(result3.index).toBe(2);

      // Finalize should succeed
      await expect(verifier.finalize()).resolves.toBeUndefined();
    });

    it('should detect corrupt chunk immediately', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(200);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      // First chunk is valid
      const chunk1 = data.slice(0, chunkSize);
      const result1 = await verifier.verifyNextChunk(chunk1);
      expect(result1.valid).toBe(true);

      // Second chunk is tampered
      const tamperedChunk = new Uint8Array(chunkSize);
      tamperedChunk.fill(0xFF);
      const result2 = await verifier.verifyNextChunk(tamperedChunk);
      expect(result2.valid).toBe(false);
      expect(result2.index).toBe(1);
    });

    it('should handle partial data until chunk is complete', async () => {
      // Use multiple chunks so partial data handling is meaningful
      const chunkSize = 100;
      const data = new Uint8Array(200); // 2 chunks
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      expect(chunked.hashes.length).toBe(2);

      // Feed partial data (less than chunk size)
      const partial1 = data.slice(0, 30);
      const result1 = await verifier.verifyNextChunk(partial1);
      expect(result1.partial).toBe(true);
      expect(result1.index).toBe(-1);

      const partial2 = data.slice(30, 60);
      const result2 = await verifier.verifyNextChunk(partial2);
      expect(result2.partial).toBe(true);

      // Complete the first chunk
      const partial3 = data.slice(60, 100);
      const result3 = await verifier.verifyNextChunk(partial3);
      expect(result3.valid).toBe(true);
      expect(result3.index).toBe(0);

      // Feed the second (last) chunk
      const chunk2 = data.slice(100, 200);
      const result4 = await verifier.verifyNextChunk(chunk2);
      expect(result4.valid).toBe(true);
      expect(result4.index).toBe(1);
    });

    it('should fail finalize if incomplete', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(200);

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      // Only provide first chunk
      const chunk1 = data.slice(0, chunkSize);
      await verifier.verifyNextChunk(chunk1);

      // Finalize should fail
      await expect(verifier.finalize()).rejects.toThrow('Incomplete data');
    });
  });

  describe('edge cases', () => {
    it('should throw for empty data', async () => {
      const data = new Uint8Array(0);

      await expect(generateChunkedHashes(data)).rejects.toThrow();
    });

    it('should handle single byte', async () => {
      const data = new Uint8Array([42]);
      const chunked = await generateChunkedHashes(data);

      expect(chunked.hashes.length).toBe(1);
      expect(chunked.root).toBe(chunked.hashes[0]);

      // Verify the single byte
      const isValid = await verifyChunk(data, chunked.hashes[0]);
      expect(isValid).toBe(true);
    });

    it('should handle data exactly at chunk boundary', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(chunkSize); // Exactly one chunk
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);

      expect(chunked.hashes.length).toBe(1);
      expect(chunked.root).toBe(chunked.hashes[0]);

      const verifier = createChunkedVerifier(chunked);
      const result = await verifier.verifyNextChunk(data);
      expect(result.valid).toBe(true);
      expect(result.index).toBe(0);
    });

    it('should handle data exactly at multiple chunk boundaries', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(chunkSize * 3); // Exactly 3 chunks
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);

      expect(chunked.hashes.length).toBe(3);

      const verifier = createChunkedVerifier(chunked);

      for (let i = 0; i < 3; i++) {
        const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
        const result = await verifier.verifyNextChunk(chunk);
        expect(result.valid).toBe(true);
        expect(result.index).toBe(i);
      }

      await expect(verifier.finalize()).resolves.toBeUndefined();
    });

    it('should handle data one byte over chunk boundary', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(chunkSize + 1); // One byte over
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);

      expect(chunked.hashes.length).toBe(2);

      const verifier = createChunkedVerifier(chunked);

      const chunk1 = data.slice(0, chunkSize);
      const result1 = await verifier.verifyNextChunk(chunk1);
      expect(result1.valid).toBe(true);

      const chunk2 = data.slice(chunkSize); // Just 1 byte
      const result2 = await verifier.verifyNextChunk(chunk2);
      expect(result2.valid).toBe(true);
    });

    it('should handle data one byte under chunk boundary', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(chunkSize - 1); // One byte under
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);

      expect(chunked.hashes.length).toBe(1);
    });

    it('should produce different hashes for different data', async () => {
      const data1 = new TextEncoder().encode('Hello');
      const data2 = new TextEncoder().encode('World');

      const chunked1 = await generateChunkedHashes(data1);
      const chunked2 = await generateChunkedHashes(data2);

      expect(chunked1.root).not.toBe(chunked2.root);
    });

    it('should produce consistent hashes for same data', async () => {
      const data = new TextEncoder().encode('Consistent Test Data');

      const chunked1 = await generateChunkedHashes(data);
      const chunked2 = await generateChunkedHashes(data);
      const chunked3 = await generateChunkedHashes(data);

      expect(chunked1.root).toBe(chunked2.root);
      expect(chunked2.root).toBe(chunked3.root);
    });

    it('should handle all zeros data', async () => {
      const data = new Uint8Array(500);
      data.fill(0);

      const chunked = await generateChunkedHashes(data, 100);

      expect(chunked.hashes.length).toBe(5);

      // All chunks should have the same hash (all zeros)
      expect(chunked.hashes[0]).toBe(chunked.hashes[1]);
      expect(chunked.hashes[1]).toBe(chunked.hashes[2]);
    });

    it('should handle all 0xFF data', async () => {
      const data = new Uint8Array(500);
      data.fill(0xFF);

      const chunked = await generateChunkedHashes(data, 100);

      expect(chunked.hashes.length).toBe(5);
    });

    it('should detect single bit flip in chunk', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(chunkSize);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);

      // Flip one bit
      const corrupted = new Uint8Array(data);
      corrupted[50] ^= 0x01; // Flip lowest bit of byte 50

      const isValid = await verifyChunk(corrupted, chunked.hashes[0]);
      expect(isValid).toBe(false);
    });

    it('should detect corruption at first byte', async () => {
      const data = new Uint8Array(100);
      for (let i = 0; i < data.length; i++) {
        data[i] = i;
      }

      const chunked = await generateChunkedHashes(data, 100);

      const corrupted = new Uint8Array(data);
      corrupted[0] = data[0] === 0 ? 1 : 0;

      const isValid = await verifyChunk(corrupted, chunked.hashes[0]);
      expect(isValid).toBe(false);
    });

    it('should detect corruption at last byte', async () => {
      const data = new Uint8Array(100);
      for (let i = 0; i < data.length; i++) {
        data[i] = i;
      }

      const chunked = await generateChunkedHashes(data, 100);

      const corrupted = new Uint8Array(data);
      corrupted[99] = data[99] === 0 ? 1 : 0;

      const isValid = await verifyChunk(corrupted, chunked.hashes[0]);
      expect(isValid).toBe(false);
    });
  });

  describe('algorithm variations', () => {
    it('should produce different hashes for different algorithms', async () => {
      const data = new TextEncoder().encode('Test data');

      const sha256 = await generateChunkedHashes(data, DEFAULT_CHUNK_SIZE, 'sha256');
      const sha384 = await generateChunkedHashes(data, DEFAULT_CHUNK_SIZE, 'sha384');
      const sha512 = await generateChunkedHashes(data, DEFAULT_CHUNK_SIZE, 'sha512');

      expect(sha256.root).not.toBe(sha384.root);
      expect(sha384.root).not.toBe(sha512.root);
      expect(sha256.root).toMatch(/^sha256-/);
      expect(sha384.root).toMatch(/^sha384-/);
      expect(sha512.root).toMatch(/^sha512-/);
    });

    it('should verify chunks with matching algorithm', async () => {
      const data = new TextEncoder().encode('Test');

      const chunked384 = await generateChunkedHashes(data, DEFAULT_CHUNK_SIZE, 'sha384');
      const isValid = await verifyChunk(data, chunked384.hashes[0], 'sha384');
      expect(isValid).toBe(true);
    });
  });

  describe('verifier state management', () => {
    it('should track totalChunks correctly', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(350); // 4 chunks

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      expect(verifier.totalChunks).toBe(4);
    });

    it('should track currentChunkIndex correctly', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(200);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      expect(verifier.currentChunkIndex).toBe(0);

      const chunk1 = data.slice(0, chunkSize);
      await verifier.verifyNextChunk(chunk1);
      expect(verifier.currentChunkIndex).toBe(1);

      const chunk2 = data.slice(chunkSize);
      await verifier.verifyNextChunk(chunk2);
      expect(verifier.currentChunkIndex).toBe(2);
    });
  });

  describe('streaming chunk accumulation', () => {
    it('should accumulate very small fragments correctly', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(150);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      // Feed in 10-byte fragments
      for (let i = 0; i < 100; i += 10) {
        const fragment = data.slice(i, i + 10);
        const result = await verifier.verifyNextChunk(fragment);

        if (i + 10 < 100) {
          expect(result.partial).toBe(true);
        } else {
          // Last fragment completes first chunk
          expect(result.valid).toBe(true);
          expect(result.index).toBe(0);
        }
      }

      // Feed the rest
      const lastChunk = data.slice(100);
      const finalResult = await verifier.verifyNextChunk(lastChunk);
      expect(finalResult.valid).toBe(true);
      expect(finalResult.index).toBe(1);
    });

    it('should handle single byte at a time for multi-chunk data', async () => {
      const chunkSize = 5;
      const data = new Uint8Array(15); // 3 chunks of 5 bytes each
      for (let i = 0; i < data.length; i++) {
        data[i] = i;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      expect(chunked.hashes.length).toBe(3);

      const verifier = createChunkedVerifier(chunked);

      // Feed bytes for first chunk (indices 0-4)
      for (let i = 0; i < 4; i++) {
        const result = await verifier.verifyNextChunk(new Uint8Array([data[i]]));
        expect(result.partial).toBe(true);
      }

      // 5th byte completes first chunk
      const result1 = await verifier.verifyNextChunk(new Uint8Array([data[4]]));
      expect(result1.valid).toBe(true);
      expect(result1.index).toBe(0);

      // Feed bytes for second chunk (indices 5-9)
      // The second chunk is NOT the last, so partial should work
      for (let i = 5; i < 9; i++) {
        const result = await verifier.verifyNextChunk(new Uint8Array([data[i]]));
        expect(result.partial).toBe(true);
      }

      // 10th byte completes second chunk
      const result2 = await verifier.verifyNextChunk(new Uint8Array([data[9]]));
      expect(result2.valid).toBe(true);
      expect(result2.index).toBe(1);

      // Feed the third (last) chunk all at once
      const lastChunk = data.slice(10, 15);
      const finalResult = await verifier.verifyNextChunk(lastChunk);
      expect(finalResult.valid).toBe(true);
      expect(finalResult.index).toBe(2);
    });

    it('should handle chunk crossing boundaries', async () => {
      const chunkSize = 100;
      const data = new Uint8Array(200);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      // Feed 150 bytes (crosses chunk boundary)
      const bigFragment = data.slice(0, 150);
      const result1 = await verifier.verifyNextChunk(bigFragment);

      // First chunk should be verified
      expect(result1.valid).toBe(true);
      expect(result1.index).toBe(0);

      // Feed remaining 50 bytes
      const remainder = data.slice(150);
      const result2 = await verifier.verifyNextChunk(remainder);
      expect(result2.valid).toBe(true);
      expect(result2.index).toBe(1);
    });
  });

  describe('large scale tests', () => {
    it('should handle 100 chunks', async () => {
      const chunkSize = 1024;
      const data = new Uint8Array(100 * chunkSize);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);

      expect(chunked.hashes.length).toBe(100);

      const verifier = createChunkedVerifier(chunked);

      for (let i = 0; i < 100; i++) {
        const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
        const result = await verifier.verifyNextChunk(chunk);
        expect(result.valid).toBe(true);
        expect(result.index).toBe(i);
      }

      await expect(verifier.finalize()).resolves.toBeUndefined();
    });

    it('should fail fast on early corruption in large file', async () => {
      const chunkSize = 1024;
      const numChunks = 50;
      const data = new Uint8Array(numChunks * chunkSize);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunked = await generateChunkedHashes(data, chunkSize);
      const verifier = createChunkedVerifier(chunked);

      // First chunk is corrupted
      const corruptedChunk = new Uint8Array(chunkSize);
      corruptedChunk.fill(0xFF);

      const result = await verifier.verifyNextChunk(corruptedChunk);
      expect(result.valid).toBe(false);
      expect(result.index).toBe(0);

      // We detected corruption at chunk 0 without processing the other 49 chunks
    });
  });
});
