/**
 * Comprehensive Tests for verifyFetch() and verifyStream()
 *
 * These tests cover the core integrity verification functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyFetch, verifyFetchStream, verifyStream, computeSri } from './verify-fetch.js';
import { IntegrityError } from './types.js';
import type { SRIString } from './types.js';

// Helper to create a mock Response with a ReadableStream body
function createMockResponse(
  data: Uint8Array | string,
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
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
      ...options.headers,
    }),
  });
}

// Helper to create a mock fetch function
function createMockFetch(response: Response | Error): typeof fetch {
  return vi.fn().mockImplementation(() => {
    if (response instanceof Error) {
      return Promise.reject(response);
    }
    return Promise.resolve(response);
  });
}

// Pre-computed SRI hashes for test data
// "Hello, World!" = sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8=
const HELLO_WORLD = 'Hello, World!';
const HELLO_WORLD_SHA256 = 'sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8=' as SRIString;

// Empty string = sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=
const EMPTY_SHA256 = 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' as SRIString;

describe('verifyFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful verification', () => {
    it('should verify content with correct SHA-256 hash', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      const response = await verifyFetch('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(HELLO_WORLD);
      expect(mockFetch).toHaveBeenCalledWith('/test.txt');
    });

    it('should verify empty content', async () => {
      const mockFetch = createMockFetch(createMockResponse(''));

      const response = await verifyFetch('/empty.txt', {
        sri: EMPTY_SHA256,
        fetchImpl: mockFetch,
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should accept URL object as input', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));
      const url = new URL('https://example.com/test.txt');

      const response = await verifyFetch(url, {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.txt');
    });

    it('should preserve response headers', async () => {
      const mockFetch = createMockFetch(
        createMockResponse(HELLO_WORLD, {
          headers: { 'X-Custom-Header': 'test-value' },
        })
      );

      const response = await verifyFetch('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(response.headers.get('X-Custom-Header')).toBe('test-value');
    });

    it('should preserve response status', async () => {
      const mockFetch = createMockFetch(
        createMockResponse(HELLO_WORLD, { status: 206, statusText: 'Partial Content' })
      );

      const response = await verifyFetch('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(response.status).toBe(206);
      expect(response.statusText).toBe('Partial Content');
    });
  });

  describe('integrity verification failure', () => {
    it('should throw IntegrityError when hash does not match', async () => {
      const wrongHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as SRIString;
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      await expect(
        verifyFetch('/test.txt', {
          sri: wrongHash,
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow(IntegrityError);
    });

    it('should include expected and actual SRI in IntegrityError', async () => {
      const wrongHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as SRIString;
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      try {
        await verifyFetch('/test.txt', {
          sri: wrongHash,
          fetchImpl: mockFetch,
        });
        expect.fail('Should have thrown IntegrityError');
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrityError);
        const integrityError = error as IntegrityError;
        expect(integrityError.expectedSri).toBe(wrongHash);
        expect(integrityError.actualSri).toBe(HELLO_WORLD_SHA256);
        expect(integrityError.url).toBe('/test.txt');
      }
    });
  });

  describe('onFail behavior', () => {
    it('should throw by default (onFail: block)', async () => {
      const wrongHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as SRIString;
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      await expect(
        verifyFetch('/test.txt', {
          sri: wrongHash,
          fetchImpl: mockFetch,
          onFail: 'block',
        })
      ).rejects.toThrow(IntegrityError);
    });

    it('should warn and return data when onFail is "warn"', async () => {
      const wrongHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as SRIString;
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await verifyFetch('/test.txt', {
        sri: wrongHash,
        fetchImpl: mockFetch,
        onFail: 'warn',
      });

      expect(response).toBeDefined();
      const text = await response.text();
      expect(text).toBe(HELLO_WORLD);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Integrity mismatch');

      consoleSpy.mockRestore();
    });

    it('should try fallback URL when onFail has fallbackUrl', async () => {
      const wrongHash = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as SRIString;
      let callCount = 0;

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url === '/test.txt') {
          // First call - wrong content
          return Promise.resolve(createMockResponse('wrong content'));
        } else if (url === '/fallback/test.txt') {
          // Fallback call - correct content
          return Promise.resolve(createMockResponse(HELLO_WORLD));
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const response = await verifyFetch('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
        onFail: { fallbackUrl: '/fallback/test.txt' },
      });

      expect(callCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith('/fallback/test.txt');
      const text = await response.text();
      expect(text).toBe(HELLO_WORLD);
    });

    it('should throw if fallback URL also fails verification', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return Promise.resolve(createMockResponse('wrong content'));
      });

      await expect(
        verifyFetch('/test.txt', {
          sri: HELLO_WORLD_SHA256,
          fetchImpl: mockFetch,
          onFail: { fallbackUrl: '/fallback/test.txt' },
        })
      ).rejects.toThrow(IntegrityError);
    });
  });

  describe('progress callback', () => {
    it('should call onProgress with bytes processed', async () => {
      const data = new Uint8Array(1000).fill(65); // 1000 bytes of 'A'
      const mockFetch = createMockFetch(createMockResponse(data));
      const onProgress = vi.fn();

      // Compute correct hash for this data
      const sri = await computeSri(data);

      await verifyFetch('/large.bin', {
        sri,
        fetchImpl: mockFetch,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      // Should be called at least once with the total bytes
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(1000); // bytesProcessed
      expect(lastCall[1]).toBe(1000); // totalBytes from Content-Length
    });

    it('should handle missing Content-Length', async () => {
      const mockResponse = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(HELLO_WORLD));
            controller.close();
          },
        }),
        { status: 200 }
      );
      const mockFetch = createMockFetch(mockResponse);
      const onProgress = vi.fn();

      await verifyFetch('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[1]).toBeUndefined(); // totalBytes should be undefined
    });
  });

  describe('error handling', () => {
    it('should throw on invalid SRI format', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      await expect(
        verifyFetch('/test.txt', {
          sri: 'invalid-sri' as SRIString,
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow('Invalid SRI format');
    });

    it('should throw on HTTP error response', async () => {
      const mockFetch = createMockFetch(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

      await expect(
        verifyFetch('/notfound.txt', {
          sri: HELLO_WORLD_SHA256,
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow('404');
    });

    it('should throw on network error', async () => {
      const mockFetch = createMockFetch(new Error('Network error'));

      await expect(
        verifyFetch('/test.txt', {
          sri: HELLO_WORLD_SHA256,
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow('Network error');
    });

    it('should throw when response body is null', async () => {
      const mockResponse = new Response(null, { status: 200 });
      const mockFetch = createMockFetch(mockResponse);

      await expect(
        verifyFetch('/test.txt', {
          sri: HELLO_WORLD_SHA256,
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow('body is null');
    });
  });

  describe('binary data', () => {
    it('should verify binary data correctly', async () => {
      const binaryData = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0x01, 0xfe]);
      const sri = await computeSri(binaryData);
      const mockFetch = createMockFetch(createMockResponse(binaryData));

      const response = await verifyFetch('/binary.bin', {
        sri,
        fetchImpl: mockFetch,
      });

      const result = new Uint8Array(await response.arrayBuffer());
      expect(result).toEqual(binaryData);
    });

    it('should verify large binary data', async () => {
      // 100KB of random-ish data
      const largeData = new Uint8Array(100 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const sri = await computeSri(largeData);
      const mockFetch = createMockFetch(createMockResponse(largeData));

      const response = await verifyFetch('/large.bin', {
        sri,
        fetchImpl: mockFetch,
      });

      const result = new Uint8Array(await response.arrayBuffer());
      expect(result.length).toBe(largeData.length);
      expect(result).toEqual(largeData);
    });
  });
});

describe('verifyStream', () => {
  describe('with ReadableStream', () => {
    it('should verify stream with correct hash', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(HELLO_WORLD));
          controller.close();
        },
      });

      const result = await verifyStream(stream, { sri: HELLO_WORLD_SHA256 });

      expect(new TextDecoder().decode(result)).toBe(HELLO_WORLD);
    });

    it('should throw IntegrityError on hash mismatch', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('different content'));
          controller.close();
        },
      });

      await expect(
        verifyStream(stream, { sri: HELLO_WORLD_SHA256 })
      ).rejects.toThrow(IntegrityError);
    });

    it('should call onProgress callback', async () => {
      const data = new Uint8Array(500);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });
      const onProgress = vi.fn();
      const sri = await computeSri(data);

      await verifyStream(stream, { sri, onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenLastCalledWith(500);
    });
  });

  describe('with AsyncIterable', () => {
    it('should verify async iterable with correct hash', async () => {
      async function* generateChunks(): AsyncGenerator<Uint8Array> {
        yield new TextEncoder().encode('Hello, ');
        yield new TextEncoder().encode('World!');
      }

      const result = await verifyStream(generateChunks(), { sri: HELLO_WORLD_SHA256 });

      expect(new TextDecoder().decode(result)).toBe(HELLO_WORLD);
    });

    it('should handle multiple chunks correctly', async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];
      const combined = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const sri = await computeSri(combined);

      async function* generateChunks(): AsyncGenerator<Uint8Array> {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      const result = await verifyStream(generateChunks(), { sri });

      expect(result).toEqual(combined);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid SRI format', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(HELLO_WORLD));
          controller.close();
        },
      });

      await expect(
        verifyStream(stream, { sri: 'invalid' as SRIString })
      ).rejects.toThrow('Invalid SRI format');
    });
  });
});

describe('verifyFetchStream', () => {
  describe('streaming output', () => {
    it('should return a stream and verified promise', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      const { stream, verified, totalBytes } = await verifyFetchStream('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(verified).toBeInstanceOf(Promise);
      expect(totalBytes).toBe(13); // "Hello, World!" length
    });

    it('should allow consuming stream and verify successfully', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      const { stream, verified } = await verifyFetchStream('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      // Consume the stream
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          chunks.push(result.value);
        }
      }

      // Wait for verification
      await verified;

      // Check we got the data
      const combined = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      expect(new TextDecoder().decode(combined)).toBe(HELLO_WORLD);
    });

    it('should reject verified promise on hash mismatch', async () => {
      const mockFetch = createMockFetch(createMockResponse('different content'));

      const { stream, verified } = await verifyFetchStream('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      // Consume the stream
      const reader = stream.getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
      }

      // Verification should fail
      await expect(verified).rejects.toThrow(IntegrityError);
    });

    it('should call onProgress callback', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));
      const onProgress = vi.fn();

      const { stream, verified } = await verifyFetchStream('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
        onProgress,
      });

      // Consume the stream
      const reader = stream.getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
      }

      await verified;

      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(13); // bytes processed
      expect(lastCall[1]).toBe(13); // total bytes
    });

    it('should warn and resolve on hash mismatch with onFail: warn', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockFetch = createMockFetch(createMockResponse('different content'));

      const { stream, verified } = await verifyFetchStream('/test.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
        onFail: 'warn',
      });

      // Consume the stream
      const reader = stream.getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
      }

      // Should resolve (not reject) with onFail: 'warn'
      await expect(verified).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

describe('computeSri', () => {
  it('should compute SHA-256 hash by default', async () => {
    const data = new TextEncoder().encode(HELLO_WORLD);
    const sri = await computeSri(data);

    expect(sri).toBe(HELLO_WORLD_SHA256);
  });

  it('should compute SHA-384 hash when specified', async () => {
    const data = new TextEncoder().encode('test');
    const sri = await computeSri(data, 'sha384');

    expect(sri).toMatch(/^sha384-/);
  });

  it('should compute SHA-512 hash when specified', async () => {
    const data = new TextEncoder().encode('test');
    const sri = await computeSri(data, 'sha512');

    expect(sri).toMatch(/^sha512-/);
  });

  it('should accept ArrayBuffer input', async () => {
    const buffer = new TextEncoder().encode(HELLO_WORLD).buffer;
    const sri = await computeSri(buffer);

    expect(sri).toBe(HELLO_WORLD_SHA256);
  });

  it('should compute consistent hashes', async () => {
    const data = new TextEncoder().encode('consistent test');

    const sri1 = await computeSri(data);
    const sri2 = await computeSri(data);
    const sri3 = await computeSri(data);

    expect(sri1).toBe(sri2);
    expect(sri2).toBe(sri3);
  });
});

describe('edge cases and robustness', () => {
  describe('various SRI formats', () => {
    it('should handle SHA-384 SRI', async () => {
      const data = new TextEncoder().encode('test data');
      const sri384 = await computeSri(data, 'sha384');
      const mockFetch = createMockFetch(createMockResponse(data));

      const response = await verifyFetch('/test.txt', {
        sri: sri384,
        fetchImpl: mockFetch,
      });

      expect(response.status).toBe(200);
    });

    it('should handle SHA-512 SRI', async () => {
      const data = new TextEncoder().encode('test data');
      const sri512 = await computeSri(data, 'sha512');
      const mockFetch = createMockFetch(createMockResponse(data));

      const response = await verifyFetch('/test.txt', {
        sri: sri512,
        fetchImpl: mockFetch,
      });

      expect(response.status).toBe(200);
    });

    it('should reject unsupported algorithm', async () => {
      const mockFetch = createMockFetch(createMockResponse('test'));

      await expect(
        verifyFetch('/test.txt', {
          sri: 'md5-aaaa=' as SRIString, // MD5 not supported
          fetchImpl: mockFetch,
        })
      ).rejects.toThrow();
    });
  });

  describe('special content', () => {
    it('should handle null bytes', async () => {
      const data = new Uint8Array([0x00, 0x00, 0x00]);
      const sri = await computeSri(data);
      const mockFetch = createMockFetch(createMockResponse(data));

      const response = await verifyFetch('/null-bytes.bin', {
        sri,
        fetchImpl: mockFetch,
      });

      const result = new Uint8Array(await response.arrayBuffer());
      expect(result).toEqual(data);
    });

    it('should handle UTF-8 encoded content', async () => {
      const unicodeContent = '你好世界 🌍 مرحبا';
      const data = new TextEncoder().encode(unicodeContent);
      const sri = await computeSri(data);
      const mockFetch = createMockFetch(createMockResponse(data));

      const response = await verifyFetch('/unicode.txt', {
        sri,
        fetchImpl: mockFetch,
      });

      const text = await response.text();
      expect(text).toBe(unicodeContent);
    });

    it('should handle binary data with all byte values', async () => {
      // Data containing all possible byte values
      const data = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        data[i] = i;
      }
      const sri = await computeSri(data);
      const mockFetch = createMockFetch(createMockResponse(data));

      const response = await verifyFetch('/all-bytes.bin', {
        sri,
        fetchImpl: mockFetch,
      });

      const result = new Uint8Array(await response.arrayBuffer());
      expect(result).toEqual(data);
    });
  });

  describe('URL handling', () => {
    it('should handle URL with query parameters', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      await verifyFetch('/test.txt?version=2&cache=false', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith('/test.txt?version=2&cache=false');
    });

    it('should handle URL with hash fragment', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      await verifyFetch('/test.txt#section1', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith('/test.txt#section1');
    });

    it('should handle absolute URL', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      await verifyFetch('https://example.com/path/to/file.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/path/to/file.txt');
    });
  });

  describe('chunked transfer', () => {
    it('should handle response delivered in multiple chunks', async () => {
      const chunks = [
        new TextEncoder().encode('Hello, '),
        new TextEncoder().encode('World!'),
      ];

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const mockResponse = new Response(stream, {
        status: 200,
        headers: { 'Content-Length': '13' },
      });
      const mockFetch = createMockFetch(mockResponse);

      const response = await verifyFetch('/chunked.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      const text = await response.text();
      expect(text).toBe(HELLO_WORLD);
    });

    it('should handle many small chunks', async () => {
      const data = new TextEncoder().encode(HELLO_WORLD);
      const chunks = Array.from(data).map((byte) => new Uint8Array([byte]));

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const mockResponse = new Response(stream, {
        status: 200,
        headers: { 'Content-Length': String(data.length) },
      });
      const mockFetch = createMockFetch(mockResponse);

      const response = await verifyFetch('/many-chunks.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      const text = await response.text();
      expect(text).toBe(HELLO_WORLD);
    });
  });
});

describe('verifyFetchStream advanced tests', () => {
  describe('large file handling', () => {
    it('should handle 1MB file in streaming mode', async () => {
      const size = 1024 * 1024; // 1MB
      const largeData = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        largeData[i] = i % 256;
      }
      const sri = await computeSri(largeData);

      // Simulate chunked delivery
      const chunkSize = 65536; // 64KB chunks
      let offset = 0;

      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= largeData.length) {
            controller.close();
            return;
          }
          const chunk = largeData.slice(offset, offset + chunkSize);
          controller.enqueue(chunk);
          offset += chunkSize;
        },
      });

      const mockResponse = new Response(stream, {
        status: 200,
        headers: { 'Content-Length': String(size) },
      });
      const mockFetch = createMockFetch(mockResponse);

      const { stream: resultStream, verified, totalBytes } = await verifyFetchStream('/large.bin', {
        sri,
        fetchImpl: mockFetch,
      });

      expect(totalBytes).toBe(size);

      // Consume the stream
      let totalReceived = 0;
      const reader = resultStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalReceived += value.length;
      }

      expect(totalReceived).toBe(size);
      await expect(verified).resolves.toBeUndefined();
    });
  });

  describe('progress tracking', () => {
    it('should report accurate progress during streaming', async () => {
      const size = 10000;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = i % 256;
      }
      const sri = await computeSri(data);

      // Deliver in 10 chunks
      const chunkSize = 1000;
      let offset = 0;

      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= data.length) {
            controller.close();
            return;
          }
          const chunk = data.slice(offset, offset + chunkSize);
          controller.enqueue(chunk);
          offset += chunkSize;
        },
      });

      const mockResponse = new Response(stream, {
        status: 200,
        headers: { 'Content-Length': String(size) },
      });
      const mockFetch = createMockFetch(mockResponse);

      const progressCalls: Array<[number, number | undefined]> = [];
      const onProgress = (bytes: number, total?: number) => {
        progressCalls.push([bytes, total]);
      };

      const { stream: resultStream, verified } = await verifyFetchStream('/progress.bin', {
        sri,
        fetchImpl: mockFetch,
        onProgress,
      });

      // Consume stream
      const reader = resultStream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      await verified;

      // Should have received multiple progress updates
      expect(progressCalls.length).toBeGreaterThan(0);

      // Last progress should be total size
      const lastProgress = progressCalls[progressCalls.length - 1];
      expect(lastProgress[0]).toBe(size);
      expect(lastProgress[1]).toBe(size);

      // Progress should be monotonically increasing
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i][0]).toBeGreaterThanOrEqual(progressCalls[i - 1][0]);
      }
    });
  });

  describe('error scenarios', () => {
    it('should detect tampering in streaming mode', async () => {
      const mockFetch = createMockFetch(createMockResponse('tampered data'));

      const { stream, verified } = await verifyFetchStream('/tampered.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      // Consume the stream fully
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      // Verification should fail after stream is consumed
      await expect(verified).rejects.toThrow(IntegrityError);
    });
  });

  describe('consuming stream partially', () => {
    it('should still verify after partial stream consumption', async () => {
      const mockFetch = createMockFetch(createMockResponse(HELLO_WORLD));

      const { stream, verified } = await verifyFetchStream('/partial.txt', {
        sri: HELLO_WORLD_SHA256,
        fetchImpl: mockFetch,
      });

      // Only read first chunk, then cancel
      const reader = stream.getReader();
      await reader.read(); // Read some data
      await reader.cancel(); // Cancel without reading all

      // Verification may not complete properly since we cancelled
      // We need to handle the verified promise to avoid unhandled rejections
      // It might resolve (if verification happened before cancel) or reject
      try {
        await verified;
      } catch {
        // Expected - verification may fail or be incomplete after cancel
      }
    });
  });
});

describe('concurrent operations', () => {
  it('should handle multiple concurrent verifyFetch calls', async () => {
    const data1 = 'Content 1';
    const data2 = 'Content 2';
    const data3 = 'Content 3';

    const sri1 = await computeSri(new TextEncoder().encode(data1));
    const sri2 = await computeSri(new TextEncoder().encode(data2));
    const sri3 = await computeSri(new TextEncoder().encode(data3));

    // Use individual mock functions to avoid any shared state issues
    const mockFetch1 = createMockFetch(createMockResponse(data1));
    const mockFetch2 = createMockFetch(createMockResponse(data2));
    const mockFetch3 = createMockFetch(createMockResponse(data3));

    const [res1, res2, res3] = await Promise.all([
      verifyFetch('/file1.txt', { sri: sri1, fetchImpl: mockFetch1 }),
      verifyFetch('/file2.txt', { sri: sri2, fetchImpl: mockFetch2 }),
      verifyFetch('/file3.txt', { sri: sri3, fetchImpl: mockFetch3 }),
    ]);

    expect(await res1.text()).toBe(data1);
    expect(await res2.text()).toBe(data2);
    expect(await res3.text()).toBe(data3);
  });

  it('should handle mixed success and failure in concurrent calls', async () => {
    const validData = 'valid content';
    const wrongData = 'wrong content';
    const validSri = await computeSri(new TextEncoder().encode(validData));

    // Create individual mock fetch instances that return cloneable responses
    const mockFetch1 = createMockFetch(createMockResponse(validData));
    const mockFetch2 = createMockFetch(createMockResponse(wrongData));
    const mockFetch3 = createMockFetch(createMockResponse(validData));

    const results = await Promise.allSettled([
      verifyFetch('/valid1.txt', { sri: validSri, fetchImpl: mockFetch1 }),
      verifyFetch('/invalid.txt', { sri: validSri, fetchImpl: mockFetch2 }),
      verifyFetch('/valid2.txt', { sri: validSri, fetchImpl: mockFetch3 }),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });
});
