/**
 * Real Integration Tests for @verifyfetch/webllm
 *
 * These tests use REAL network requests to HuggingFace to verify
 * actual model files. No mocks - this tests the full pipeline.
 *
 * Tests include:
 * - Fetching real model config files from HuggingFace
 * - Computing and verifying real SHA-256 hashes
 * - Testing verification failures with tampered data
 * - Testing progress reporting
 * - Detailed logging throughout
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { computeSri, verifyFetch } from 'verifyfetch';
import type { ModelVerificationManifest, PreloadProgress } from '../src/types.js';
import { validateManifest, getModelEntry, getFileUrl } from '../src/model-manifest.js';

// Real HuggingFace model URLs for testing
// Using small JSON config files for fast tests
const REAL_MODEL_BASE_URL = 'https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC/resolve/main/';
const REAL_CONFIG_FILE = 'mlc-chat-config.json';
const REAL_TOKENIZER_CONFIG = 'tokenizer_config.json';

// Test timeout for network operations
const NETWORK_TIMEOUT = 30000;

// Verbose logging helper
function log(section: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  console.log(`[${timestamp}] [${section}] ${message}`);
  if (data !== undefined) {
    console.log('  Data:', typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
}

describe('Real Integration Tests', () => {
  // Store real hashes computed from actual file contents
  let realConfigHash: string;
  let realTokenizerConfigHash: string;
  let realConfigContent: string;
  let realTokenizerConfigContent: string;

  beforeAll(async () => {
    log('SETUP', 'Starting real integration test setup');
    log('SETUP', `Target model URL: ${REAL_MODEL_BASE_URL}`);

    // Fetch real files and compute their actual hashes
    log('FETCH', `Downloading ${REAL_CONFIG_FILE}...`);
    const configResponse = await fetch(REAL_MODEL_BASE_URL + REAL_CONFIG_FILE);
    if (!configResponse.ok) {
      throw new Error(`Failed to fetch ${REAL_CONFIG_FILE}: ${configResponse.status}`);
    }
    realConfigContent = await configResponse.text();
    const configBytes = new TextEncoder().encode(realConfigContent);
    realConfigHash = await computeSri(configBytes);
    log('FETCH', `Downloaded ${REAL_CONFIG_FILE}`, {
      size: configBytes.length,
      hash: realConfigHash,
      preview: realConfigContent.slice(0, 100) + '...',
    });

    log('FETCH', `Downloading ${REAL_TOKENIZER_CONFIG}...`);
    const tokenizerResponse = await fetch(REAL_MODEL_BASE_URL + REAL_TOKENIZER_CONFIG);
    if (!tokenizerResponse.ok) {
      throw new Error(`Failed to fetch ${REAL_TOKENIZER_CONFIG}: ${tokenizerResponse.status}`);
    }
    realTokenizerConfigContent = await tokenizerResponse.text();
    const tokenizerBytes = new TextEncoder().encode(realTokenizerConfigContent);
    realTokenizerConfigHash = await computeSri(tokenizerBytes);
    log('FETCH', `Downloaded ${REAL_TOKENIZER_CONFIG}`, {
      size: tokenizerBytes.length,
      hash: realTokenizerConfigHash,
      preview: realTokenizerConfigContent.slice(0, 100) + '...',
    });

    log('SETUP', 'Setup complete - all real files fetched and hashed');
  }, NETWORK_TIMEOUT);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SHA-256 Hash Computation', () => {
    it('computes deterministic hashes for the same content', async () => {
      log('TEST', 'Testing deterministic hash computation');

      const content = new TextEncoder().encode(realConfigContent);

      // Compute hash multiple times
      const hash1 = await computeSri(content);
      const hash2 = await computeSri(content);
      const hash3 = await computeSri(content);

      log('TEST', 'Hash computation results', { hash1, hash2, hash3 });

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);

      log('TEST', 'PASSED: Hashes are deterministic');
    });

    it('produces different hashes for different content', async () => {
      log('TEST', 'Testing hash uniqueness');

      const hash1 = realConfigHash;
      const hash2 = realTokenizerConfigHash;

      log('TEST', 'Different file hashes', { configHash: hash1, tokenizerHash: hash2 });

      expect(hash1).not.toBe(hash2);
      log('TEST', 'PASSED: Different files produce different hashes');
    });

    it('detects single-byte modifications', async () => {
      log('TEST', 'Testing hash sensitivity to single-byte changes');

      const original = new TextEncoder().encode(realConfigContent);
      const originalHash = await computeSri(original);

      // Modify a single byte
      const modified = new Uint8Array(original);
      modified[0] = modified[0] === 0 ? 1 : 0;
      const modifiedHash = await computeSri(modified);

      log('TEST', 'Single byte modification detection', {
        originalHash,
        modifiedHash,
        bytesChanged: 1,
      });

      expect(originalHash).not.toBe(modifiedHash);
      log('TEST', 'PASSED: Single byte change produces different hash');
    });
  });

  describe('Real Network Verification', () => {
    it('verifies real HuggingFace config file with correct hash', async () => {
      log('TEST', 'Testing verification with real HuggingFace file');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;
      log('TEST', `Fetching ${url} with hash ${realConfigHash}`);

      const response = await verifyFetch(url, {
        sri: realConfigHash as `sha256-${string}`,
      });

      const data = await response.text();

      log('TEST', 'Verification result', {
        status: response.status,
        contentLength: data.length,
        matches: data === realConfigContent,
      });

      expect(response.ok).toBe(true);
      expect(data).toBe(realConfigContent);
      log('TEST', 'PASSED: Real file verification successful');
    }, NETWORK_TIMEOUT);

    it('verifies multiple files in sequence', async () => {
      log('TEST', 'Testing sequential verification of multiple files');

      const files = [
        { name: REAL_CONFIG_FILE, hash: realConfigHash, expectedContent: realConfigContent },
        { name: REAL_TOKENIZER_CONFIG, hash: realTokenizerConfigHash, expectedContent: realTokenizerConfigContent },
      ];

      for (const file of files) {
        const url = REAL_MODEL_BASE_URL + file.name;
        log('TEST', `Verifying ${file.name}...`);

        const startTime = Date.now();
        const response = await verifyFetch(url, {
          sri: file.hash as `sha256-${string}`,
        });
        const elapsed = Date.now() - startTime;

        const content = await response.text();

        log('TEST', `Verified ${file.name}`, {
          elapsed: `${elapsed}ms`,
          size: content.length,
          verified: content === file.expectedContent,
        });

        expect(content).toBe(file.expectedContent);
      }

      log('TEST', 'PASSED: All files verified successfully');
    }, NETWORK_TIMEOUT * 2);

    it('rejects verification with wrong hash', async () => {
      log('TEST', 'Testing verification rejection with wrong hash');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;
      const wrongHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      log('TEST', `Attempting verification with wrong hash`, {
        url,
        correctHash: realConfigHash,
        wrongHash,
      });

      await expect(
        verifyFetch(url, {
          sri: wrongHash as `sha256-${string}`,
          onFail: 'block',
        })
      ).rejects.toThrow();

      log('TEST', 'PASSED: Verification correctly rejected with wrong hash');
    }, NETWORK_TIMEOUT);

    it('warns but continues with onFail=warn', async () => {
      log('TEST', 'Testing onFail=warn behavior');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;
      const wrongHash = 'sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      log('TEST', 'Verifying with wrong hash and onFail=warn');

      const response = await verifyFetch(url, {
        sri: wrongHash as `sha256-${string}`,
        onFail: 'warn',
      });

      const content = await response.text();

      log('TEST', 'Result with onFail=warn', {
        contentReceived: content.length > 0,
        warnCalled: warnSpy.mock.calls.length > 0,
      });

      expect(response.ok).toBe(true);
      expect(content.length).toBeGreaterThan(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      log('TEST', 'PASSED: onFail=warn works correctly');
    }, NETWORK_TIMEOUT);
  });

  describe('Progress Reporting', () => {
    it('reports progress during download', async () => {
      log('TEST', 'Testing progress reporting');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;
      const progressEvents: { bytesLoaded: number; totalBytes?: number }[] = [];

      log('TEST', 'Starting download with progress tracking');

      await verifyFetch(url, {
        sri: realConfigHash as `sha256-${string}`,
        onProgress: (bytesLoaded, totalBytes) => {
          progressEvents.push({ bytesLoaded, totalBytes });
          log('PROGRESS', `${bytesLoaded}/${totalBytes ?? 'unknown'} bytes`);
        },
      });

      log('TEST', 'Progress events received', {
        eventCount: progressEvents.length,
        firstEvent: progressEvents[0],
        lastEvent: progressEvents[progressEvents.length - 1],
      });

      expect(progressEvents.length).toBeGreaterThan(0);

      // Last event should have loaded all bytes
      const lastEvent = progressEvents[progressEvents.length - 1];
      if (lastEvent.totalBytes) {
        expect(lastEvent.bytesLoaded).toBe(lastEvent.totalBytes);
      }

      log('TEST', 'PASSED: Progress reporting works');
    }, NETWORK_TIMEOUT);
  });

  describe('Manifest Integration', () => {
    it('creates and validates a manifest with real hashes', async () => {
      log('TEST', 'Testing manifest creation with real hashes');

      const manifest: ModelVerificationManifest = {
        version: 2,
        models: {
          'Phi-3.5-mini-instruct-q4f16_1-MLC': {
            baseUrl: REAL_MODEL_BASE_URL,
            files: {
              [REAL_CONFIG_FILE]: {
                sri: realConfigHash as `sha256-${string}`,
              },
              [REAL_TOKENIZER_CONFIG]: {
                sri: realTokenizerConfigHash as `sha256-${string}`,
              },
            },
          },
        },
      };

      log('TEST', 'Created manifest', manifest);

      // Validate the manifest
      const validated = validateManifest(manifest);
      expect(validated).toBeDefined();
      expect(validated.version).toBe(2);

      // Get model entry
      const entry = getModelEntry('Phi-3.5-mini-instruct-q4f16_1-MLC', manifest);
      expect(entry.baseUrl).toBe(REAL_MODEL_BASE_URL);
      expect(Object.keys(entry.files)).toHaveLength(2);

      // Check file URLs
      const configUrl = getFileUrl('Phi-3.5-mini-instruct-q4f16_1-MLC', REAL_CONFIG_FILE, manifest);
      expect(configUrl).toBe(REAL_MODEL_BASE_URL + REAL_CONFIG_FILE);

      log('TEST', 'PASSED: Manifest with real hashes is valid');
    });

    it('verifies files using manifest entries', async () => {
      log('TEST', 'Testing full manifest-based verification');

      const manifest: ModelVerificationManifest = {
        version: 2,
        models: {
          'test-model': {
            baseUrl: REAL_MODEL_BASE_URL,
            files: {
              [REAL_CONFIG_FILE]: {
                sri: realConfigHash as `sha256-${string}`,
              },
            },
          },
        },
      };

      const entry = getModelEntry('test-model', manifest);
      const fileInfo = entry.files[REAL_CONFIG_FILE];
      const url = getFileUrl('test-model', REAL_CONFIG_FILE, manifest);

      log('TEST', 'Verifying file from manifest', {
        url,
        sri: fileInfo.sri,
      });

      const response = await verifyFetch(url, {
        sri: fileInfo.sri,
      });

      expect(response.ok).toBe(true);
      const content = await response.text();
      expect(content).toBe(realConfigContent);

      log('TEST', 'PASSED: Manifest-based verification works');
    }, NETWORK_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('handles 404 errors gracefully', async () => {
      log('TEST', 'Testing 404 error handling');

      const url = REAL_MODEL_BASE_URL + 'nonexistent-file-12345.json';

      log('TEST', `Attempting to fetch non-existent file: ${url}`);

      await expect(
        verifyFetch(url, {
          sri: realConfigHash as `sha256-${string}`,
        })
      ).rejects.toThrow(/404|not found/i);

      log('TEST', 'PASSED: 404 errors handled correctly');
    }, NETWORK_TIMEOUT);

    it('provides detailed error messages on verification failure', async () => {
      log('TEST', 'Testing detailed error messages');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;
      const wrongHash = 'sha256-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=';

      try {
        await verifyFetch(url, {
          sri: wrongHash as `sha256-${string}`,
          onFail: 'block',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        log('TEST', 'Error caught', {
          name: (error as Error).name,
          message: (error as Error).message.slice(0, 200),
        });

        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message.toLowerCase();
        expect(
          errorMessage.includes('integrity') ||
          errorMessage.includes('mismatch') ||
          errorMessage.includes('verification')
        ).toBe(true);
      }

      log('TEST', 'PASSED: Detailed error messages provided');
    }, NETWORK_TIMEOUT);
  });

  describe('Content Integrity', () => {
    it('returns exact content after verification', async () => {
      log('TEST', 'Testing content integrity after verification');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;

      const response = await verifyFetch(url, {
        sri: realConfigHash as `sha256-${string}`,
      });

      const verifiedContent = await response.text();

      log('TEST', 'Content comparison', {
        originalLength: realConfigContent.length,
        verifiedLength: verifiedContent.length,
        exactMatch: verifiedContent === realConfigContent,
      });

      // Byte-by-byte comparison
      expect(verifiedContent).toBe(realConfigContent);

      // Parse as JSON to ensure validity
      const parsed = JSON.parse(verifiedContent);
      // Check for actual properties in WebLLM config files
      expect(parsed).toHaveProperty('model_type');
      expect(parsed).toHaveProperty('quantization');

      log('TEST', 'PASSED: Content is exactly preserved');
    }, NETWORK_TIMEOUT);

    it('detects content tampering via proxy/CDN simulation', async () => {
      log('TEST', 'Testing tampering detection');

      // Create tampered content - add extra data to change the hash
      const tamperedContent = realConfigContent + '\n{"tampered": true}';
      const tamperedBytes = new TextEncoder().encode(tamperedContent);
      const tamperedHash = await computeSri(tamperedBytes);

      log('TEST', 'Tampered content analysis', {
        originalLength: realConfigContent.length,
        tamperedLength: tamperedContent.length,
        originalHash: realConfigHash,
        tamperedHash: tamperedHash,
        hashesMatch: realConfigHash === tamperedHash,
      });

      // Verify hashes are different
      expect(realConfigHash).not.toBe(tamperedHash);

      // Create a fetch mock that returns tampered content with proper streaming body
      const tamperedFetch = vi.fn(async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(tamperedBytes);
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': tamperedBytes.length.toString(),
          },
        });
      });

      log('TEST', 'Attempting verification with tampered content (should fail)');

      try {
        await verifyFetch(REAL_MODEL_BASE_URL + REAL_CONFIG_FILE, {
          sri: realConfigHash as `sha256-${string}`,
          fetchImpl: tamperedFetch,
          onFail: 'block',
        });
        // If we get here, the test should fail
        expect.fail('Should have thrown IntegrityError');
      } catch (error) {
        log('TEST', 'Correctly caught tampering', {
          errorName: (error as Error).name,
          errorMessage: (error as Error).message.slice(0, 100),
        });
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message.toLowerCase()).toMatch(/integrity|mismatch/);
      }

      log('TEST', 'PASSED: Tampered content detected');
    });
  });

  describe('Performance', () => {
    it('completes verification within acceptable time', async () => {
      log('TEST', 'Testing verification performance');

      const url = REAL_MODEL_BASE_URL + REAL_CONFIG_FILE;
      const iterations = 3;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await verifyFetch(url, {
          sri: realConfigHash as `sha256-${string}`,
        });
        const elapsed = Date.now() - start;
        times.push(elapsed);
        log('PERF', `Iteration ${i + 1}: ${elapsed}ms`);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      log('TEST', 'Performance results', {
        iterations,
        times,
        average: `${avgTime.toFixed(2)}ms`,
        min: `${Math.min(...times)}ms`,
        max: `${Math.max(...times)}ms`,
      });

      // Should complete within reasonable time for a small config file
      expect(avgTime).toBeLessThan(5000); // 5 seconds max average

      log('TEST', 'PASSED: Performance is acceptable');
    }, NETWORK_TIMEOUT * 3);
  });
});

describe('Edge Cases', () => {
  it('handles empty response gracefully', async () => {
    log('TEST', 'Testing empty response handling');

    // Empty content has a specific SHA-256
    const emptyHash = await computeSri(new Uint8Array(0));
    log('TEST', 'Empty content hash', { hash: emptyHash });

    expect(emptyHash).toBe('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');

    // Create mock that returns empty content
    const emptyFetch = vi.fn(async () => {
      return new Response('', {
        status: 200,
        headers: { 'Content-Length': '0' },
      });
    });

    const response = await verifyFetch('https://example.com/empty', {
      sri: emptyHash as `sha256-${string}`,
      fetchImpl: emptyFetch,
    });

    const content = await response.text();
    expect(content).toBe('');

    log('TEST', 'PASSED: Empty content handled correctly');
  });

  it('handles unicode content correctly', async () => {
    log('TEST', 'Testing unicode content handling');

    const unicodeContent = '{"emoji": "🚀🔐", "chinese": "你好世界", "arabic": "مرحبا"}';
    const bytes = new TextEncoder().encode(unicodeContent);
    const unicodeHash = await computeSri(bytes);

    log('TEST', 'Unicode content hash', {
      content: unicodeContent,
      byteLength: bytes.length,
      hash: unicodeHash,
    });

    const unicodeFetch = vi.fn(async () => {
      return new Response(unicodeContent, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    });

    const response = await verifyFetch('https://example.com/unicode', {
      sri: unicodeHash as `sha256-${string}`,
      fetchImpl: unicodeFetch,
    });

    const result = await response.text();
    expect(result).toBe(unicodeContent);

    log('TEST', 'PASSED: Unicode content verified correctly');
  });

  it('handles large JSON correctly', async () => {
    log('TEST', 'Testing large JSON handling');

    // Create a large JSON object
    const largeObj: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      largeObj[`key_${i}`] = `value_${i}_${'x'.repeat(100)}`;
    }
    const largeContent = JSON.stringify(largeObj);
    const bytes = new TextEncoder().encode(largeContent);
    const largeHash = await computeSri(bytes);

    log('TEST', 'Large JSON stats', {
      keyCount: 1000,
      byteLength: bytes.length,
      hash: largeHash.slice(0, 30) + '...',
    });

    const largeFetch = vi.fn(async () => {
      return new Response(largeContent, {
        status: 200,
        headers: { 'Content-Length': bytes.length.toString() },
      });
    });

    const response = await verifyFetch('https://example.com/large', {
      sri: largeHash as `sha256-${string}`,
      fetchImpl: largeFetch,
    });

    const result = await response.text();
    expect(result).toBe(largeContent);
    expect(JSON.parse(result)).toHaveProperty('key_999');

    log('TEST', 'PASSED: Large JSON verified correctly');
  });
});
