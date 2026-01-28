/**
 * Tests for preloader.ts
 *
 * Tests model preloading with verification.
 * Uses real data with real hashes where possible.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ModelVerificationManifest, PreloadProgress } from '../src/types.js';

// Mock IndexedDB for resumable downloads
import 'fake-indexeddb/auto';

// We need to mock the Cache API since it's not available in Node
const mockCache = new Map<string, ArrayBuffer>();

const mockCacheStorage = {
  open: vi.fn(async () => ({
    match: vi.fn(async (url: string) => {
      const data = mockCache.get(url);
      if (data) {
        return {
          arrayBuffer: async () => data,
        };
      }
      return undefined;
    }),
    put: vi.fn(async (url: string, response: Response) => {
      const data = await response.arrayBuffer();
      mockCache.set(url, data);
    }),
    delete: vi.fn(async (url: string) => {
      mockCache.delete(url);
      return true;
    }),
  })),
  delete: vi.fn(async () => {
    mockCache.clear();
    return true;
  }),
};

// @ts-expect-error - mocking global caches
global.caches = mockCacheStorage;

// Now import the modules (after mocking)
import {
  preloadVerifiedModel,
  isModelCached,
  clearModelCache,
  getPreloadProgress,
} from '../src/preloader.js';

// Test data with real SHA-256 hashes
// These are real hashes computed from the test data
const TEST_CONFIG_JSON = JSON.stringify({ model: 'test', version: 1 });
const TEST_TOKENIZER_JSON = JSON.stringify({ tokens: ['a', 'b', 'c'] });

// Compute actual SHA-256 hashes for test data
async function computeSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `sha256-${hashBase64}`;
}

let configHash: string;
let tokenizerHash: string;

// Create manifest with real hashes
async function createTestManifest(): Promise<ModelVerificationManifest> {
  configHash = await computeSha256(TEST_CONFIG_JSON);
  tokenizerHash = await computeSha256(TEST_TOKENIZER_JSON);

  return {
    version: 2,
    models: {
      'test-model': {
        baseUrl: 'https://test.example.com/models/test/',
        files: {
          'config.json': {
            sri: configHash as `sha256-${string}`,
          },
          'tokenizer.json': {
            sri: tokenizerHash as `sha256-${string}`,
          },
        },
      },
    },
  };
}

// Mock fetch that returns correct test data
function createMockFetch() {
  return vi.fn(async (url: string) => {
    if (url.endsWith('config.json')) {
      return new Response(TEST_CONFIG_JSON, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('tokenizer.json')) {
      return new Response(TEST_TOKENIZER_JSON, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  });
}

describe('preloadVerifiedModel', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    mockCache.clear();
    vi.clearAllMocks();
    manifest = await createTestManifest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads and verifies all model files', async () => {
    const mockFetch = createMockFetch();

    const result = await preloadVerifiedModel('test-model', {
      manifest,
      fetchImpl: mockFetch,
      resumable: false,
    });

    expect(result.modelId).toBe('test-model');
    expect(result.totalFiles).toBe(2);
    expect(result.resumed).toBe(false);
    expect(result.filesResumed).toBe(0);
    expect(result.totalBytes).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);

    // Verify fetch was called for each file
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('caches verified files', async () => {
    const mockFetch = createMockFetch();

    await preloadVerifiedModel('test-model', {
      manifest,
      fetchImpl: mockFetch,
      resumable: false,
    });

    // Check cache was populated
    expect(mockCache.size).toBe(2);
    expect(mockCache.has('https://test.example.com/models/test/config.json')).toBe(true);
    expect(mockCache.has('https://test.example.com/models/test/tokenizer.json')).toBe(true);
  });

  it('reports progress during download', async () => {
    const mockFetch = createMockFetch();
    const progressEvents: PreloadProgress[] = [];

    await preloadVerifiedModel('test-model', {
      manifest,
      fetchImpl: mockFetch,
      resumable: false,
      onProgress: (p) => progressEvents.push({ ...p }),
    });

    // Should have progress events
    expect(progressEvents.length).toBeGreaterThan(0);

    // Should end with completion
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent.phase).toBe('complete');
    expect(lastEvent.filesComplete).toBe(2);
    expect(lastEvent.totalFiles).toBe(2);
  });

  it('skips already cached files', async () => {
    const mockFetch = createMockFetch();

    // Pre-populate cache
    mockCache.set(
      'https://test.example.com/models/test/config.json',
      new TextEncoder().encode(TEST_CONFIG_JSON).buffer as ArrayBuffer
    );

    await preloadVerifiedModel('test-model', {
      manifest,
      fetchImpl: mockFetch,
      resumable: false,
    });

    // Only tokenizer.json should be fetched
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://test.example.com/models/test/tokenizer.json');
  });

  it('throws on verification failure with onFail=block', async () => {
    // Create manifest with wrong hash
    const badManifest: ModelVerificationManifest = {
      version: 2,
      models: {
        'test-model': {
          baseUrl: 'https://test.example.com/models/test/',
          files: {
            'config.json': {
              sri: 'sha256-wronghash00000000000000000000000000000000000=',
            },
          },
        },
      },
    };

    const mockFetch = createMockFetch();

    await expect(
      preloadVerifiedModel('test-model', {
        manifest: badManifest,
        fetchImpl: mockFetch,
        resumable: false,
        onFail: 'block',
      })
    ).rejects.toThrow();
  });

  it('warns but continues on verification failure with onFail=warn', async () => {
    const badManifest: ModelVerificationManifest = {
      version: 2,
      models: {
        'test-model': {
          baseUrl: 'https://test.example.com/models/test/',
          files: {
            'config.json': {
              sri: 'sha256-wronghash00000000000000000000000000000000000=',
            },
          },
        },
      },
    };

    const mockFetch = createMockFetch();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await preloadVerifiedModel('test-model', {
      manifest: badManifest,
      fetchImpl: mockFetch,
      resumable: false,
      onFail: 'warn',
    });

    expect(result.totalFiles).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('isModelCached', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    mockCache.clear();
    vi.clearAllMocks();
    manifest = await createTestManifest();
  });

  it('returns false when no files are cached', async () => {
    const cached = await isModelCached('test-model', { manifest });
    expect(cached).toBe(false);
  });

  it('returns false when only some files are cached', async () => {
    mockCache.set(
      'https://test.example.com/models/test/config.json',
      new TextEncoder().encode(TEST_CONFIG_JSON).buffer as ArrayBuffer
    );

    const cached = await isModelCached('test-model', { manifest });
    expect(cached).toBe(false);
  });

  it('returns true when all files are cached', async () => {
    mockCache.set(
      'https://test.example.com/models/test/config.json',
      new TextEncoder().encode(TEST_CONFIG_JSON).buffer as ArrayBuffer
    );
    mockCache.set(
      'https://test.example.com/models/test/tokenizer.json',
      new TextEncoder().encode(TEST_TOKENIZER_JSON).buffer as ArrayBuffer
    );

    const cached = await isModelCached('test-model', { manifest });
    expect(cached).toBe(true);
  });
});

describe('clearModelCache', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    mockCache.clear();
    vi.clearAllMocks();
    manifest = await createTestManifest();
  });

  it('clears specific model from cache', async () => {
    mockCache.set(
      'https://test.example.com/models/test/config.json',
      new TextEncoder().encode(TEST_CONFIG_JSON).buffer as ArrayBuffer
    );
    mockCache.set(
      'https://test.example.com/models/test/tokenizer.json',
      new TextEncoder().encode(TEST_TOKENIZER_JSON).buffer as ArrayBuffer
    );

    await clearModelCache('test-model', { manifest });

    expect(mockCache.size).toBe(0);
  });

  it('clears all cache when no modelId provided', async () => {
    mockCache.set('url1', new ArrayBuffer(10));
    mockCache.set('url2', new ArrayBuffer(10));

    await clearModelCache();

    expect(mockCacheStorage.delete).toHaveBeenCalled();
  });
});

describe('getPreloadProgress', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    mockCache.clear();
    vi.clearAllMocks();
    manifest = await createTestManifest();
  });

  it('returns null when no files are cached', async () => {
    const progress = await getPreloadProgress('test-model', { manifest });
    expect(progress).toBeNull();
  });

  it('returns progress when some files are cached', async () => {
    // Add size info to manifest
    manifest.models['test-model'].files['config.json'].size = 100;
    manifest.models['test-model'].files['tokenizer.json'].size = 200;

    mockCache.set(
      'https://test.example.com/models/test/config.json',
      new TextEncoder().encode(TEST_CONFIG_JSON).buffer as ArrayBuffer
    );

    const progress = await getPreloadProgress('test-model', { manifest });

    expect(progress).not.toBeNull();
    expect(progress!.filesComplete).toBe(1);
    expect(progress!.totalFiles).toBe(2);
  });
});
