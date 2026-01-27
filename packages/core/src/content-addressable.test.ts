/**
 * Comprehensive Tests for Content-Addressable URLs and Multi-CDN Failover
 *
 * These tests cover URL parsing, multi-CDN strategies, error handling,
 * timeouts, and edge cases for production readiness.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseContentAddressableUrl,
  createContentAddressableUrl,
  verifyFetchFromSources,
  resolveContentAddressable,
} from './content-addressable.js';
import type { SRIString } from './types.js';

// Mock verifyFetch module
vi.mock('./verify-fetch.js', () => ({
  verifyFetch: vi.fn(),
  verifyFetchStream: vi.fn(),
}));

import { verifyFetch } from './verify-fetch.js';

const mockVerifyFetch = vi.mocked(verifyFetch);

// Helper to create delayed responses for testing
const createDelayedResponse = (delay: number, response: Response | Error) => {
  return new Promise<Response>((resolve, reject) => {
    setTimeout(() => {
      if (response instanceof Error) {
        reject(response);
      } else {
        resolve(response);
      }
    }, delay);
  });
};

describe('Content-Addressable URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseContentAddressableUrl', () => {
    it('should parse valid sha256 vf:// URL', () => {
      const result = parseContentAddressableUrl(
        'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin'
      );

      expect(result).toEqual({
        sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
        path: '/model.bin',
      });
    });

    it('should parse valid sha384 vf:// URL', () => {
      const result = parseContentAddressableUrl(
        'vf://sha384/abc123def456+78=/path/to/file.wasm'
      );

      expect(result).toEqual({
        sri: 'sha384-abc123def456+78=',
        path: '/path/to/file.wasm',
      });
    });

    it('should parse valid sha512 vf:// URL', () => {
      const result = parseContentAddressableUrl(
        'vf://sha512/longHash123=/deep/nested/path/model.onnx'
      );

      expect(result).toEqual({
        sri: 'sha512-longHash123=',
        path: '/deep/nested/path/model.onnx',
      });
    });

    it('should return null for non-vf:// URLs', () => {
      expect(parseContentAddressableUrl('https://example.com/file.bin')).toBeNull();
      expect(parseContentAddressableUrl('http://test.com')).toBeNull();
      expect(parseContentAddressableUrl('/local/path')).toBeNull();
    });

    it('should return null for invalid algorithm', () => {
      expect(
        parseContentAddressableUrl('vf://md5/hash123=/file.bin')
      ).toBeNull();
      expect(
        parseContentAddressableUrl('vf://sha1/hash123=/file.bin')
      ).toBeNull();
    });

    it('should return null for malformed vf:// URLs', () => {
      expect(parseContentAddressableUrl('vf://')).toBeNull();
      expect(parseContentAddressableUrl('vf://sha256')).toBeNull();
      expect(parseContentAddressableUrl('vf://sha256/hash')).toBeNull();
    });

    it('should handle paths with multiple segments', () => {
      const result = parseContentAddressableUrl(
        'vf://sha256/abc=/a/b/c/d/e/file.bin'
      );

      expect(result).toEqual({
        sri: 'sha256-abc=',
        path: '/a/b/c/d/e/file.bin',
      });
    });
  });

  describe('createContentAddressableUrl', () => {
    it('should create vf:// URL from SRI and path', () => {
      const url = createContentAddressableUrl(
        'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=' as SRIString,
        '/model.bin'
      );

      expect(url).toBe('vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin');
    });

    it('should handle paths without leading slash', () => {
      const url = createContentAddressableUrl(
        'sha384-hash123=' as SRIString,
        'file.wasm'
      );

      expect(url).toBe('vf://sha384/hash123=/file.wasm');
    });

    it('should handle deep paths', () => {
      const url = createContentAddressableUrl(
        'sha512-deepHash=' as SRIString,
        '/deep/nested/path/model.onnx'
      );

      expect(url).toBe('vf://sha512/deepHash=/deep/nested/path/model.onnx');
    });

    it('should be reversible with parseContentAddressableUrl', () => {
      const sri = 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=' as SRIString;
      const path = '/models/test.bin';

      const url = createContentAddressableUrl(sri, path);
      const parsed = parseContentAddressableUrl(url);

      expect(parsed).toEqual({ sri, path });
    });
  });

  describe('verifyFetchFromSources', () => {
    const sri = 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=' as SRIString;
    const path = '/model.bin';

    it('should throw error with empty sources array', async () => {
      await expect(
        verifyFetchFromSources(sri, path, { sources: [] })
      ).rejects.toThrow('At least one source URL is required');
    });

    describe('sequential strategy (default)', () => {
      it('should try first source and succeed', async () => {
        const mockResponse = new Response('test data');
        mockVerifyFetch.mockResolvedValueOnce(mockResponse);

        const result = await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn1.com', 'https://cdn2.com'],
        });

        expect(result).toBe(mockResponse);
        expect(mockVerifyFetch).toHaveBeenCalledTimes(1);
        expect(mockVerifyFetch).toHaveBeenCalledWith(
          'https://cdn1.com/model.bin',
          expect.objectContaining({ sri, onFail: 'block' })
        );
      });

      it('should failover to second source when first fails', async () => {
        const mockResponse = new Response('test data');
        mockVerifyFetch.mockRejectedValueOnce(new Error('Network error'));
        mockVerifyFetch.mockResolvedValueOnce(mockResponse);

        const onSourceError = vi.fn();

        const result = await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn1.com', 'https://cdn2.com'],
          onSourceError,
        });

        expect(result).toBe(mockResponse);
        expect(mockVerifyFetch).toHaveBeenCalledTimes(2);
        expect(onSourceError).toHaveBeenCalledWith(
          'https://cdn1.com',
          expect.any(Error)
        );
      });

      it('should throw AggregateError when all sources fail', async () => {
        mockVerifyFetch.mockRejectedValue(new Error('All failed'));

        await expect(
          verifyFetchFromSources(sri, path, {
            sources: ['https://cdn1.com', 'https://cdn2.com'],
          })
        ).rejects.toThrow('All 2 sources failed');
      });

      it('should call onProgress callback', async () => {
        const mockResponse = new Response('test data');
        mockVerifyFetch.mockResolvedValueOnce(mockResponse);

        const onProgress = vi.fn();

        await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn1.com'],
          onProgress,
        });

        expect(mockVerifyFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ onProgress })
        );
      });
    });

    describe('race strategy', () => {
      it('should resolve with first successful response', async () => {
        const mockResponse = new Response('test data');
        mockVerifyFetch.mockImplementation(() => {
          return Promise.resolve(mockResponse);
        });

        const result = await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn1.com', 'https://cdn2.com'],
          strategy: 'race',
        });

        expect(result).toBe(mockResponse);
      });

      it('should succeed if at least one source succeeds', async () => {
        const mockResponse = new Response('success');
        mockVerifyFetch
          .mockRejectedValueOnce(new Error('First failed'))
          .mockResolvedValueOnce(mockResponse);

        const result = await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn1.com', 'https://cdn2.com'],
          strategy: 'race',
        });

        expect(result).toBe(mockResponse);
      });

      it('should throw when all race sources fail', async () => {
        mockVerifyFetch.mockRejectedValue(new Error('All failed'));

        await expect(
          verifyFetchFromSources(sri, path, {
            sources: ['https://cdn1.com', 'https://cdn2.com'],
            strategy: 'race',
          })
        ).rejects.toThrow('All 2 sources failed');
      });
    });

    describe('fastest strategy', () => {
      it('should work like race strategy', async () => {
        const mockResponse = new Response('test data');
        mockVerifyFetch.mockResolvedValue(mockResponse);

        const result = await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn1.com', 'https://cdn2.com'],
          strategy: 'fastest',
        });

        expect(result).toBe(mockResponse);
      });
    });

    describe('URL building', () => {
      it('should handle base URLs with trailing slash', async () => {
        const mockResponse = new Response('test');
        mockVerifyFetch.mockResolvedValue(mockResponse);

        await verifyFetchFromSources(sri, path, {
          sources: ['https://cdn.com/'],
        });

        expect(mockVerifyFetch).toHaveBeenCalledWith(
          'https://cdn.com/model.bin',
          expect.any(Object)
        );
      });

      it('should handle paths without leading slash', async () => {
        const mockResponse = new Response('test');
        mockVerifyFetch.mockResolvedValue(mockResponse);

        await verifyFetchFromSources(sri, 'model.bin', {
          sources: ['https://cdn.com'],
        });

        expect(mockVerifyFetch).toHaveBeenCalledWith(
          'https://cdn.com/model.bin',
          expect.any(Object)
        );
      });
    });
  });

  describe('resolveContentAddressable', () => {
    it('should resolve vf:// URL with sources', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      const result = await resolveContentAddressable(
        'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin',
        ['https://cdn1.com', 'https://cdn2.com']
      );

      expect(result).toBe(mockResponse);
      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn1.com/model.bin',
        expect.objectContaining({
          sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
        })
      );
    });

    it('should throw for invalid vf:// URL', async () => {
      await expect(
        resolveContentAddressable('https://not-vf.com/file.bin', ['https://cdn.com'])
      ).rejects.toThrow('Invalid vf:// URL');
    });

    it('should pass options through', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      const onProgress = vi.fn();

      await resolveContentAddressable(
        'vf://sha256/hash=/file.bin',
        ['https://cdn.com'],
        {
          strategy: 'race',
          timeout: 5000,
          onProgress,
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ onProgress })
      );
    });
  });

  describe('custom fetch implementation', () => {
    it('should use custom fetchImpl', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      const customFetch = vi.fn();

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn.com'],
          fetchImpl: customFetch,
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ fetchImpl: expect.any(Function) })
      );
    });
  });

  describe('edge cases in URL parsing', () => {
    it('should handle URLs with special characters in path', () => {
      const result = parseContentAddressableUrl(
        'vf://sha256/hash123=/path/with spaces/file%20name.bin'
      );

      expect(result).toEqual({
        sri: 'sha256-hash123=',
        path: '/path/with spaces/file%20name.bin',
      });
    });

    it('should handle URLs with query-like characters in path', () => {
      const result = parseContentAddressableUrl(
        'vf://sha256/hash123=/path/file.bin?version=2'
      );

      expect(result).toEqual({
        sri: 'sha256-hash123=',
        path: '/path/file.bin?version=2',
      });
    });

    it('should handle very long paths', () => {
      const longPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/file.bin';
      const result = parseContentAddressableUrl(
        `vf://sha256/hash123=${longPath}`
      );

      expect(result?.path).toBe(longPath);
    });

    it('should handle hash with special base64 characters', () => {
      // Base64 can include + and /
      const result = parseContentAddressableUrl(
        'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin'
      );

      expect(result).toEqual({
        sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
        path: '/model.bin',
      });
    });

    it('should handle empty path segment', () => {
      const result = parseContentAddressableUrl(
        'vf://sha256/hash123=//'
      );

      expect(result).toEqual({
        sri: 'sha256-hash123=',
        path: '//',
      });
    });
  });

  describe('URL creation edge cases', () => {
    it('should handle standard SRI format', () => {
      // Standard SRI format: algorithm-hash
      const url = createContentAddressableUrl(
        'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=' as SRIString,
        '/file.bin'
      );

      expect(url).toBe('vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/file.bin');
    });

    it('should handle empty filename', () => {
      const url = createContentAddressableUrl(
        'sha256-hash=' as SRIString,
        '/'
      );

      expect(url).toBe('vf://sha256/hash=/');
    });

    it('should preserve case in path', () => {
      const url = createContentAddressableUrl(
        'sha256-hash=' as SRIString,
        '/MyFile.BIN'
      );

      expect(url).toBe('vf://sha256/hash=/MyFile.BIN');
    });
  });

  describe('error aggregation', () => {
    it('should aggregate all errors when all sources fail', async () => {
      const error1 = new Error('CDN1 timeout');
      const error2 = new Error('CDN2 connection refused');
      const error3 = new Error('CDN3 integrity mismatch');

      mockVerifyFetch
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3);

      try {
        await verifyFetchFromSources(
          'sha256-abc=' as SRIString,
          '/file.bin',
          {
            sources: ['https://cdn1.com', 'https://cdn2.com', 'https://cdn3.com'],
          }
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        const aggError = error as AggregateError;
        expect(aggError.errors).toHaveLength(3);
        expect(aggError.message).toContain('All 3 sources failed');
      }
    });

    it('should call onSourceError for each failed source', async () => {
      const mockResponse = new Response('success');
      mockVerifyFetch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(mockResponse);

      const onSourceError = vi.fn();

      const result = await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn1.com', 'https://cdn2.com', 'https://cdn3.com'],
          onSourceError,
        }
      );

      expect(result).toBe(mockResponse);
      expect(onSourceError).toHaveBeenCalledTimes(2);
      expect(onSourceError).toHaveBeenNthCalledWith(1, 'https://cdn1.com', expect.any(Error));
      expect(onSourceError).toHaveBeenNthCalledWith(2, 'https://cdn2.com', expect.any(Error));
    });
  });

  describe('source URL variations', () => {
    it('should handle sources with ports', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn.com:8443'],
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn.com:8443/file.bin',
        expect.any(Object)
      );
    });

    it('should handle sources with paths', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn.com/static/v2'],
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn.com/static/v2/file.bin',
        expect.any(Object)
      );
    });

    it('should handle IP address sources', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['http://192.168.1.100:3000'],
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:3000/file.bin',
        expect.any(Object)
      );
    });

    it('should handle mixed protocols', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://secure.cdn.com', 'http://backup.cdn.com'],
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://secure.cdn.com/file.bin',
        expect.any(Object)
      );
    });
  });

  describe('multiple paths', () => {
    it('should handle deeply nested paths', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/models/v2/llm/gpt-4/weights.bin',
        {
          sources: ['https://cdn.com'],
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn.com/models/v2/llm/gpt-4/weights.bin',
        expect.any(Object)
      );
    });

    it('should handle root path', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/',
        {
          sources: ['https://cdn.com'],
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn.com/',
        expect.any(Object)
      );
    });
  });

  describe('strategy behavior', () => {
    it('should stop after first success in sequential strategy', async () => {
      const mockResponse = new Response('success');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn1.com', 'https://cdn2.com', 'https://cdn3.com'],
          strategy: 'sequential',
        }
      );

      // Should only try first source
      expect(mockVerifyFetch).toHaveBeenCalledTimes(1);
      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn1.com/file.bin',
        expect.any(Object)
      );
    });

    it('should try all sources in race strategy', async () => {
      const mockResponse = new Response('success');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn1.com', 'https://cdn2.com', 'https://cdn3.com'],
          strategy: 'race',
        }
      );

      // All sources should be tried concurrently
      expect(mockVerifyFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle fastest strategy same as race', async () => {
      const mockResponse = new Response('success');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://cdn1.com', 'https://cdn2.com'],
          strategy: 'fastest',
        }
      );

      expect(mockVerifyFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveContentAddressable integration', () => {
    it('should correctly parse and resolve vf:// URL', async () => {
      const mockResponse = new Response('content');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await resolveContentAddressable(
        'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/path/to/model.bin',
        ['https://cdn.com']
      );

      expect(mockVerifyFetch).toHaveBeenCalledWith(
        'https://cdn.com/path/to/model.bin',
        expect.objectContaining({
          sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
        })
      );
    });

    it('should pass strategy option through', async () => {
      const mockResponse = new Response('content');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      await resolveContentAddressable(
        'vf://sha256/hash=/file.bin',
        ['https://cdn1.com', 'https://cdn2.com'],
        { strategy: 'race' }
      );

      // With race strategy, both sources are tried
      expect(mockVerifyFetch).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid vf:// URL formats', async () => {
      await expect(
        resolveContentAddressable('invalid://url', ['https://cdn.com'])
      ).rejects.toThrow('Invalid vf:// URL');

      await expect(
        resolveContentAddressable('vf://md5/hash=/file.bin', ['https://cdn.com'])
      ).rejects.toThrow('Invalid vf:// URL');

      await expect(
        resolveContentAddressable('https://normal.url/file.bin', ['https://cdn.com'])
      ).rejects.toThrow('Invalid vf:// URL');
    });
  });

  describe('single source edge cases', () => {
    it('should work with single source in sequential', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      const result = await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://only.cdn.com'],
          strategy: 'sequential',
        }
      );

      expect(result).toBe(mockResponse);
    });

    it('should work with single source in race', async () => {
      const mockResponse = new Response('test');
      mockVerifyFetch.mockResolvedValue(mockResponse);

      const result = await verifyFetchFromSources(
        'sha256-abc=' as SRIString,
        '/file.bin',
        {
          sources: ['https://only.cdn.com'],
          strategy: 'race',
        }
      );

      expect(result).toBe(mockResponse);
    });

    it('should throw clear error with single failing source', async () => {
      mockVerifyFetch.mockRejectedValue(new Error('CDN down'));

      try {
        await verifyFetchFromSources(
          'sha256-abc=' as SRIString,
          '/file.bin',
          {
            sources: ['https://only.cdn.com'],
          }
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        const aggError = error as AggregateError;
        expect(aggError.message).toContain('All 1 sources failed');
      }
    });
  });

  describe('non-string errors', () => {
    it('should handle non-Error throws', async () => {
      mockVerifyFetch.mockRejectedValueOnce('string error');
      mockVerifyFetch.mockRejectedValueOnce({ code: 500 });
      mockVerifyFetch.mockRejectedValueOnce(null);

      const onSourceError = vi.fn();

      try {
        await verifyFetchFromSources(
          'sha256-abc=' as SRIString,
          '/file.bin',
          {
            sources: ['https://cdn1.com', 'https://cdn2.com', 'https://cdn3.com'],
            onSourceError,
          }
        );
      } catch {
        // Expected
      }

      // Should convert non-Error values to Error objects
      expect(onSourceError).toHaveBeenCalledTimes(3);
      expect(onSourceError.mock.calls[0][1]).toBeInstanceOf(Error);
      expect(onSourceError.mock.calls[1][1]).toBeInstanceOf(Error);
      expect(onSourceError.mock.calls[2][1]).toBeInstanceOf(Error);
    });
  });
});
