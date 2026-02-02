/**
 * Tests for verified-pipeline.ts
 *
 * Tests the verifiedPipeline wrapper.
 * We test our wrapper logic, not Transformers.js itself.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModelVerificationManifest } from '../src/types.js';

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock Cache API
const mockCache = new Map<string, ArrayBuffer>();
const mockCacheStorage = {
  open: vi.fn(async () => ({
    match: vi.fn(async (url: string) => {
      const data = mockCache.get(url);
      if (data) {
        return { arrayBuffer: async () => data };
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

import { verifiedPipeline } from '../src/verified-pipeline.js';

// Test data
const TEST_CONFIG_JSON = JSON.stringify({ model: 'test', version: 1 });

async function computeSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `sha256-${hashBase64}`;
}

async function createTestManifest(): Promise<ModelVerificationManifest> {
  const configHash = await computeSha256(TEST_CONFIG_JSON);

  return {
    version: 2,
    models: {
      'Xenova/test-model': {
        baseUrl: 'https://huggingface.co/Xenova/test-model/resolve/main/',
        files: {
          'config.json': {
            sri: configHash as `sha256-${string}`,
          },
        },
      },
    },
  };
}

describe('verifiedPipeline', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    mockCache.clear();
    vi.clearAllMocks();
    manifest = await createTestManifest();
  });

  it('throws when model not in manifest with onFail=block', async () => {
    await expect(
      verifiedPipeline('sentiment-analysis', 'nonexistent/model', {
        manifest,
        onFail: 'block',
      })
    ).rejects.toThrow('not found in verification manifest');
  });

  it('provides available models in error message', async () => {
    try {
      await verifiedPipeline('sentiment-analysis', 'nonexistent/model', {
        manifest,
        onFail: 'block',
      });
      expect.fail('Should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('Xenova/test-model');
    }
  });

  it('rejects when pipeline creation fails', async () => {
    const mockFetch = vi.fn(async () => new Response(TEST_CONFIG_JSON));

    // After preloading succeeds, pipeline creation will fail
    // (either because transformers.js isn't installed, or because
    // the model can't actually be loaded in a test environment)
    await expect(
      verifiedPipeline('sentiment-analysis', 'Xenova/test-model', {
        manifest,
        fetchImpl: mockFetch,
      })
    ).rejects.toThrow();
  });

  it('warns but attempts pipeline when model not in manifest with onFail=warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockFetch = vi.fn(async () => new Response('{}'));

    // Should warn about missing model, then attempt pipeline creation
    try {
      await verifiedPipeline('sentiment-analysis', 'nonexistent/model', {
        manifest,
        onFail: 'warn',
        fetchImpl: mockFetch,
      });
    } catch {
      // Expected to throw — either missing dependency or pipeline failure
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not in manifest')
    );
    warnSpy.mockRestore();
  });

  it('requires manifest or manifestUrl', async () => {
    await expect(
      verifiedPipeline('sentiment-analysis', 'Xenova/test-model', {})
    ).rejects.toThrow();
  });

  it('calls onProgress during preload', async () => {
    const mockFetch = vi.fn(async () => new Response(TEST_CONFIG_JSON));
    const progressEvents: unknown[] = [];

    try {
      await verifiedPipeline('sentiment-analysis', 'Xenova/test-model', {
        manifest,
        fetchImpl: mockFetch,
        onProgress: (p) => progressEvents.push({ ...p }),
      });
    } catch {
      // Expected - transformers.js not installed
    }

    // Should have received progress events from preloading
    expect(progressEvents.length).toBeGreaterThan(0);
  });
});
