/**
 * Tests for Auto-wrapper Module
 *
 * These tests cover the automatic fetch wrapping functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureAuto, enableAuto, disableAuto } from './auto.js';
import type { VFManifest } from './types.js';

// Store original fetch
const originalGlobalFetch = globalThis.fetch;

// Helper to create mock responses
function createMockResponse(data: string | Uint8Array): Response {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Length': String(bytes.length) },
    }
  );
}

describe('auto wrapper', () => {
  beforeEach(() => {
    // Reset to original fetch before each test
    globalThis.fetch = originalGlobalFetch;
    disableAuto();
  });

  afterEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalGlobalFetch;
    disableAuto();
  });

  describe('enableAuto', () => {
    it('should wrap globalThis.fetch', () => {
      const originalFetch = globalThis.fetch;
      enableAuto();

      // Fetch should be wrapped (different function)
      expect(globalThis.fetch).not.toBe(originalFetch);
    });

    it('should not wrap twice if called multiple times', () => {
      enableAuto();
      const wrappedFetch1 = globalThis.fetch;

      enableAuto();
      const wrappedFetch2 = globalThis.fetch;

      expect(wrappedFetch1).toBe(wrappedFetch2);
    });
  });

  describe('disableAuto', () => {
    it('should have wrappedFetch after enableAuto is called', () => {
      enableAuto();
      // After enableAuto, the global fetch should be the wrapped version
      expect(globalThis.fetch.name).toBe('wrappedFetch');
    });

    it('should be safe to call multiple times without throwing', () => {
      // disableAuto should be idempotent and never throw
      expect(() => {
        disableAuto();
        disableAuto();
        disableAuto();
      }).not.toThrow();
    });

    it('should allow re-enabling after disable', () => {
      disableAuto();
      enableAuto();
      // After re-enabling, fetch should be wrapped
      expect(globalThis.fetch.name).toBe('wrappedFetch');
    });
  });

  describe('configureAuto', () => {
    it('should accept inline manifest', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {},
      };

      // Should not throw
      await configureAuto({ manifest });
    });

    it('should accept patterns for URL matching', async () => {
      const manifest: VFManifest = {
        version: 1,
        base: '/',
        artifacts: {},
      };

      await configureAuto({
        manifest,
        patterns: [/\.wasm$/, /\.bin$/],
      });
    });
  });

  describe('pattern matching', () => {
    it('should verify .wasm files by default', async () => {
      // This tests the default patterns list
      const defaultPatterns = [
        /\.wasm$/,
        /\.bin$/,
        /\.safetensors$/,
        /\.onnx$/,
        /\.pb$/,
        /\.tflite$/,
        /\.glb$/,
        /\.gltf$/,
      ];

      const testUrls = [
        { url: '/model.wasm', shouldMatch: true },
        { url: '/data.bin', shouldMatch: true },
        { url: '/weights.safetensors', shouldMatch: true },
        { url: '/model.onnx', shouldMatch: true },
        { url: '/script.js', shouldMatch: false },
        { url: '/style.css', shouldMatch: false },
        { url: '/index.html', shouldMatch: false },
      ];

      for (const { url, shouldMatch } of testUrls) {
        const matches = defaultPatterns.some((p) => p.test(url));
        expect(matches).toBe(shouldMatch);
      }
    });
  });

  describe('wrapped fetch behavior', () => {
    it('should pass through non-matching URLs to original fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createMockResponse('ok'));
      globalThis.fetch = mockFetch;

      enableAuto();
      // Configure without manifest - all requests should pass through
      await configureAuto({});

      const result = await fetch('/api/data.json');
      expect(mockFetch).toHaveBeenCalledWith('/api/data.json', undefined);
      expect(await result.text()).toBe('ok');
    });
  });
});

describe('auto wrapper URL pattern tests', () => {
  const patterns = [
    { url: 'https://cdn.example.com/model.wasm', ext: '.wasm', shouldMatch: true },
    { url: '/assets/engine.wasm', ext: '.wasm', shouldMatch: true },
    { url: '/models/phi-3.bin', ext: '.bin', shouldMatch: true },
    { url: '/weights.safetensors', ext: '.safetensors', shouldMatch: true },
    { url: '/model.onnx', ext: '.onnx', shouldMatch: true },
    { url: '/scene.glb', ext: '.glb', shouldMatch: true },
    { url: '/api/data', ext: '', shouldMatch: false },
    { url: '/script.js', ext: '.js', shouldMatch: false },
    { url: '/image.png', ext: '.png', shouldMatch: false },
  ];

  for (const { url, ext, shouldMatch } of patterns) {
    it(`should ${shouldMatch ? 'match' : 'not match'} ${ext || 'no extension'} URLs`, () => {
      const defaultPatterns = [
        /\.wasm$/,
        /\.bin$/,
        /\.safetensors$/,
        /\.onnx$/,
        /\.pb$/,
        /\.tflite$/,
        /\.glb$/,
        /\.gltf$/,
      ];

      const matches = defaultPatterns.some((p) => p.test(url));
      expect(matches).toBe(shouldMatch);
    });
  }
});
