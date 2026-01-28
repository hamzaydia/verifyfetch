/**
 * Tests for verified-engine.ts
 *
 * Tests the VerifiedMLCEngine wrapper.
 * We test our wrapper logic, not WebLLM itself.
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

import {
  VerifiedMLCEngine,
  createVerifiedEngine,
  type InitProgressReport,
} from '../src/verified-engine.js';

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
      'test-model': {
        baseUrl: 'https://test.example.com/models/test/',
        files: {
          'config.json': {
            sri: configHash as `sha256-${string}`,
          },
        },
      },
    },
  };
}

describe('VerifiedMLCEngine', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    mockCache.clear();
    vi.clearAllMocks();
    manifest = await createTestManifest();
  });

  describe('constructor', () => {
    it('creates engine with manifest config', () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest },
      });

      expect(engine).toBeInstanceOf(VerifiedMLCEngine);
      expect(engine.chat).toBeDefined();
      expect(engine.chat.completions).toBeDefined();
      expect(engine.chat.completions.create).toBeInstanceOf(Function);
    });

    it('creates engine with manifestUrl config', () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifestUrl: '/manifest.json' },
      });

      expect(engine).toBeInstanceOf(VerifiedMLCEngine);
    });
  });

  describe('getCurrentModel', () => {
    it('returns null before loading', () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest },
      });

      expect(engine.getCurrentModel()).toBeNull();
    });
  });

  describe('chat.completions.create', () => {
    it('throws if engine not loaded', async () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest },
      });

      await expect(
        engine.chat.completions.create({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('Engine not loaded');
    });
  });

  describe('generate', () => {
    it('throws if engine not loaded', async () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest },
      });

      await expect(engine.generate('Hello')).rejects.toThrow('Engine not loaded');
    });
  });

  describe('getRuntimeStats', () => {
    it('returns message if engine not loaded', async () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest },
      });

      const stats = await engine.getRuntimeStats();
      expect(stats).toBe('Engine not loaded');
    });
  });

  describe('reload', () => {
    it('throws if model not in manifest with onFail=block', async () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest, onFail: 'block' },
      });

      await expect(engine.reload('nonexistent-model')).rejects.toThrow(
        'not found in verification manifest'
      );
    });

    it('provides available models in error message', async () => {
      const engine = new VerifiedMLCEngine({
        verification: { manifest, onFail: 'block' },
      });

      try {
        await engine.reload('nonexistent-model');
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('test-model');
      }
    });

    it('throws if no manifest or manifestUrl provided', async () => {
      const engine = new VerifiedMLCEngine({
        verification: {},
      });

      await expect(engine.reload('test-model')).rejects.toThrow(
        'manifestUrl or manifest'
      );
    });
  });

  describe('progress reporting', () => {
    it('calls progress callback during verification phase', async () => {
      const progressReports: InitProgressReport[] = [];
      const mockFetch = vi.fn(async () => new Response(TEST_CONFIG_JSON));

      const engine = new VerifiedMLCEngine({
        verification: { manifest },
        initProgressCallback: (report) => progressReports.push({ ...report }),
      });

      // The actual reload will fail because WebLLM isn't installed
      // but we can test that progress is called during verification
      try {
        // Mock the WebLLM import to fail
        await engine.reload('test-model');
      } catch {
        // Expected - WebLLM not available
      }

      // Should have at least the verification progress
      expect(progressReports.length).toBeGreaterThan(0);
      expect(progressReports[0].text).toContain('Verifying');
    });
  });
});

describe('createVerifiedEngine', () => {
  it('creates engine with manifestUrl', () => {
    const engine = createVerifiedEngine('/manifest.json');
    expect(engine).toBeInstanceOf(VerifiedMLCEngine);
  });

  it('creates engine with progress callback', () => {
    const callback = vi.fn();
    const engine = createVerifiedEngine('/manifest.json', callback);
    expect(engine).toBeInstanceOf(VerifiedMLCEngine);
  });
});
