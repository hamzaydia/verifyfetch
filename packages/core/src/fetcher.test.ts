/**
 * Tests for Manifest Fetcher
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseManifest, createManifest, addArtifact, createVerifyFetcher } from './fetcher.js';
import type { VFManifest, SRIString } from './types.js';
import { computeSri } from './verify-fetch.js';

// Helper to create a mock Response with a ReadableStream body
function createMockResponse(
  data: Uint8Array | string | object,
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  let bytes: Uint8Array;
  if (typeof data === 'object' && !(data instanceof Uint8Array)) {
    bytes = new TextEncoder().encode(JSON.stringify(data));
  } else if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  return new Response(stream, {
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: new Headers({
      'Content-Length': String(bytes.length),
      'Content-Type': 'application/json',
      ...options.headers,
    }),
  });
}

// Test data
const TEST_CONTENT = 'Hello, World!';
const TEST_SRI = 'sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8=' as SRIString;

describe('parseManifest', () => {
  it('should parse valid manifest', () => {
    const content = JSON.stringify({
      version: 1,
      base: '/',
      artifacts: {
        '/engine.wasm': { sri: 'sha256-abc123' },
        '/model.bin': { sri: 'sha384-xyz789' },
      },
    });

    const manifest = parseManifest(content);

    expect(manifest.version).toBe(1);
    expect(manifest.base).toBe('/');
    expect(manifest.artifacts['/engine.wasm'].sri).toBe('sha256-abc123');
    expect(manifest.artifacts['/model.bin'].sri).toBe('sha384-xyz789');
  });

  it('should parse manifest with signatures', () => {
    const content = JSON.stringify({
      version: 1,
      base: '/assets',
      artifacts: {
        '/engine.wasm': {
          sri: 'sha256-abc123',
          signature: '/engine.wasm.sig',
          issuer: 'self',
        },
      },
    });

    const manifest = parseManifest(content);

    expect(manifest.artifacts['/engine.wasm'].signature).toBe('/engine.wasm.sig');
    expect(manifest.artifacts['/engine.wasm'].issuer).toBe('self');
  });

  it('should reject invalid JSON', () => {
    expect(() => parseManifest('not json')).toThrow();
    expect(() => parseManifest('{')).toThrow();
  });

  it('should reject invalid version', () => {
    const content = JSON.stringify({
      version: 2,
      base: '/',
      artifacts: {},
    });

    expect(() => parseManifest(content)).toThrow('version');
  });

  it('should reject non-object', () => {
    expect(() => parseManifest('"string"')).toThrow();
    expect(() => parseManifest('123')).toThrow();
    expect(() => parseManifest('null')).toThrow();
  });
});

describe('createManifest', () => {
  it('should create empty manifest with default base', () => {
    const manifest = createManifest();

    expect(manifest.version).toBe(1);
    expect(manifest.base).toBe('/');
    expect(manifest.artifacts).toEqual({});
  });

  it('should create empty manifest with custom base', () => {
    const manifest = createManifest('/assets');

    expect(manifest.base).toBe('/assets');
  });
});

describe('addArtifact', () => {
  it('should add artifact to manifest', () => {
    const manifest = createManifest();
    const updated = addArtifact(
      manifest,
      '/engine.wasm',
      'sha256-abc123' as SRIString
    );

    expect(updated.artifacts['/engine.wasm']).toEqual({
      sri: 'sha256-abc123',
    });
  });

  it('should add artifact with signature', () => {
    const manifest = createManifest();
    const updated = addArtifact(
      manifest,
      '/engine.wasm',
      'sha256-abc123' as SRIString,
      '/engine.wasm.sig'
    );

    expect(updated.artifacts['/engine.wasm']).toEqual({
      sri: 'sha256-abc123',
      signature: '/engine.wasm.sig',
    });
  });

  it('should not mutate original manifest', () => {
    const manifest = createManifest();
    const updated = addArtifact(
      manifest,
      '/engine.wasm',
      'sha256-abc123' as SRIString
    );

    expect(manifest.artifacts).toEqual({});
    expect(updated.artifacts['/engine.wasm']).toBeDefined();
  });

  it('should add multiple artifacts', () => {
    let manifest = createManifest();
    manifest = addArtifact(manifest, '/a.wasm', 'sha256-a' as SRIString);
    manifest = addArtifact(manifest, '/b.wasm', 'sha256-b' as SRIString);
    manifest = addArtifact(manifest, '/c.wasm', 'sha256-c' as SRIString);

    expect(Object.keys(manifest.artifacts)).toHaveLength(3);
  });
});

describe('createVerifyFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with inline manifest', () => {
    it('should create fetcher with inline manifest', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/test.txt': { sri: TEST_SRI },
        },
      };

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse(TEST_CONTENT))
      );

      const fetcher = await createVerifyFetcher({
        manifest,
        fetchImpl: mockFetch,
      });

      const result = await fetcher.text('/test.txt');
      expect(result).toBe(TEST_CONTENT);
    });

    it('should verify multiple files from manifest', async () => {
      const file1 = 'content-one';
      const file2 = 'content-two';

      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/file1.txt': { sri: await computeSri(new TextEncoder().encode(file1)) },
          '/file2.txt': { sri: await computeSri(new TextEncoder().encode(file2)) },
        },
      };

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('file1')) {
          return Promise.resolve(createMockResponse(file1));
        }
        return Promise.resolve(createMockResponse(file2));
      });

      const fetcher = await createVerifyFetcher({
        manifest,
        fetchImpl: mockFetch,
      });

      expect(await fetcher.text('/file1.txt')).toBe(file1);
      expect(await fetcher.text('/file2.txt')).toBe(file2);
    });
  });

  describe('with manifest URL', () => {
    it('should load manifest from URL', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/test.txt': { sri: TEST_SRI },
        },
      };

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/vf.manifest.json') {
          return Promise.resolve(createMockResponse(manifest));
        }
        return Promise.resolve(createMockResponse(TEST_CONTENT));
      });

      const fetcher = await createVerifyFetcher({
        manifestUrl: '/vf.manifest.json',
        fetchImpl: mockFetch,
      });

      const result = await fetcher.text('/test.txt');
      expect(result).toBe(TEST_CONTENT);
      expect(mockFetch).toHaveBeenCalledWith('/vf.manifest.json');
    });

    it('should throw if manifest URL returns 404', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response('Not Found', { status: 404 }))
      );

      await expect(
        createVerifyFetcher({
          manifestUrl: '/missing.json',
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow('Failed to load manifest');
    });

    it('should throw if manifest is invalid JSON', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse('not json'))
      );

      await expect(
        createVerifyFetcher({
          manifestUrl: '/invalid.json',
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow();
    });
  });

  describe('fetcher methods', () => {
    const createTestFetcher = async () => {
      const jsonData = { key: 'value', number: 42 };
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);

      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/text.txt': { sri: await computeSri(new TextEncoder().encode(TEST_CONTENT)) },
          '/data.json': { sri: await computeSri(new TextEncoder().encode(JSON.stringify(jsonData))) },
          '/binary.bin': { sri: await computeSri(binaryData) },
        },
      };

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('text.txt')) {
          return Promise.resolve(createMockResponse(TEST_CONTENT));
        }
        if (url.includes('data.json')) {
          return Promise.resolve(createMockResponse(jsonData));
        }
        if (url.includes('binary.bin')) {
          return Promise.resolve(createMockResponse(binaryData));
        }
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });

      return {
        fetcher: await createVerifyFetcher({ manifest, fetchImpl: mockFetch }),
        jsonData,
        binaryData,
      };
    };

    it('should return text with .text()', async () => {
      const { fetcher } = await createTestFetcher();
      const result = await fetcher.text('/text.txt');
      expect(result).toBe(TEST_CONTENT);
    });

    it('should return parsed JSON with .json()', async () => {
      const { fetcher, jsonData } = await createTestFetcher();
      const result = await fetcher.json('/data.json');
      expect(result).toEqual(jsonData);
    });

    it('should return ArrayBuffer with .arrayBuffer()', async () => {
      const { fetcher, binaryData } = await createTestFetcher();
      const result = await fetcher.arrayBuffer('/binary.bin');
      expect(new Uint8Array(result)).toEqual(binaryData);
    });

    it('should return Blob with .blob()', async () => {
      const { fetcher, binaryData } = await createTestFetcher();
      const result = await fetcher.blob('/binary.bin');
      const arrayBuffer = await result.arrayBuffer();
      expect(new Uint8Array(arrayBuffer)).toEqual(binaryData);
    });

    it('should return Response with .fetch()', async () => {
      const { fetcher } = await createTestFetcher();
      const response = await fetcher.fetch('/text.txt');
      expect(response).toBeInstanceOf(Response);
      expect(await response.text()).toBe(TEST_CONTENT);
    });
  });

  describe('preload', () => {
    it('should preload manifest', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {},
      };

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse(manifest))
      );

      const fetcher = await createVerifyFetcher({
        manifestUrl: '/manifest.json',
        fetchImpl: mockFetch,
      });

      await fetcher.preload();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only once, not twice
    });
  });

  describe('reloadManifest', () => {
    it('should reload manifest from URL', async () => {
      let callCount = 0;
      const manifest1: VFManifest = {
        version: 1,
        base: '/',
        artifacts: { '/old.txt': { sri: TEST_SRI } },
      };
      const manifest2: VFManifest = {
        version: 1,
        base: '/',
        artifacts: { '/new.txt': { sri: TEST_SRI } },
      };

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/manifest.json') {
          callCount++;
          return Promise.resolve(createMockResponse(callCount === 1 ? manifest1 : manifest2));
        }
        return Promise.resolve(createMockResponse(TEST_CONTENT));
      });

      const fetcher = await createVerifyFetcher({
        manifestUrl: '/manifest.json',
        fetchImpl: mockFetch,
      });

      // Initially should have old.txt
      await fetcher.text('/old.txt');

      // Reload and check new manifest
      await fetcher.reloadManifest();

      // Now should have new.txt
      await expect(fetcher.text('/new.txt')).resolves.toBe(TEST_CONTENT);
    });
  });

  describe('error handling', () => {
    it('should throw when no manifest provided', async () => {
      const fetcher = await createVerifyFetcher({});

      await expect(fetcher.text('/test.txt')).rejects.toThrow('No manifest provided');
    });

    it('should throw when artifact not found in manifest', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/exists.txt': { sri: TEST_SRI },
        },
      };

      const fetcher = await createVerifyFetcher({ manifest });

      await expect(fetcher.text('/missing.txt')).rejects.toThrow('No manifest entry found');
    });

    it('should throw on integrity mismatch', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/test.txt': { sri: 'sha256-WRONGHASH' as SRIString },
        },
      };

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse(TEST_CONTENT))
      );

      const fetcher = await createVerifyFetcher({
        manifest,
        fetchImpl: mockFetch,
      });

      await expect(fetcher.text('/test.txt')).rejects.toThrow();
    });
  });

  describe('URL resolution', () => {
    it('should resolve relative paths with baseUrl', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/assets/test.txt': { sri: TEST_SRI },
        },
      };

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse(TEST_CONTENT))
      );

      const fetcher = await createVerifyFetcher({
        manifest,
        fetchImpl: mockFetch,
        baseUrl: 'https://cdn.example.com/',
      });

      await fetcher.text('/assets/test.txt');

      expect(mockFetch).toHaveBeenCalledWith('https://cdn.example.com/assets/test.txt');
    });

    it('should handle absolute URLs', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {
          '/test.txt': { sri: TEST_SRI },
        },
      };

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(createMockResponse(TEST_CONTENT))
      );

      const fetcher = await createVerifyFetcher({
        manifest,
        fetchImpl: mockFetch,
      });

      await fetcher.text('https://other.com/test.txt');

      expect(mockFetch).toHaveBeenCalledWith('https://other.com/test.txt');
    });
  });
});
