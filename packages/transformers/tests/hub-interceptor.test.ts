/**
 * Tests for hub-interceptor.ts
 *
 * Tests the createVerifiedFetch function and global verification toggle.
 * We test our wrapper logic, not Transformers.js itself.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ModelVerificationManifest } from '../src/types.js';
import {
  createVerifiedFetch,
  isVerificationEnabled,
} from '../src/hub-interceptor.js';

// Test data
const TEST_CONFIG_JSON = JSON.stringify({ model: 'test', version: 1 });
const TEST_TOKENIZER_JSON = JSON.stringify({ tokens: ['a', 'b', 'c'] });

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
  const tokenizerHash = await computeSha256(TEST_TOKENIZER_JSON);

  return {
    version: 2,
    models: {
      'Xenova/test-model': {
        baseUrl: 'https://huggingface.co/Xenova/test-model/resolve/main/',
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

function createMockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('config.json')) {
      return new Response(TEST_CONFIG_JSON, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('tokenizer.json')) {
      return new Response(TEST_TOKENIZER_JSON, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  });
}

describe('createVerifiedFetch', () => {
  let manifest: ModelVerificationManifest;

  beforeEach(async () => {
    manifest = await createTestManifest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies fetches for URLs in the manifest', async () => {
    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(manifest, 'block', baseFetch);

    const response = await verifiedFetch(
      'https://huggingface.co/Xenova/test-model/resolve/main/config.json'
    );

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe(TEST_CONFIG_JSON);
  });

  it('passes through fetches for URLs not in manifest', async () => {
    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(manifest, 'block', baseFetch);

    const response = await verifiedFetch('https://other.example.com/some-file.js');

    // Should pass through to base fetch
    expect(baseFetch).toHaveBeenCalledWith(
      'https://other.example.com/some-file.js',
      undefined
    );
  });

  it('throws on verification failure with onFail=block', async () => {
    const badManifest: ModelVerificationManifest = {
      version: 2,
      models: {
        'Xenova/test-model': {
          baseUrl: 'https://huggingface.co/Xenova/test-model/resolve/main/',
          files: {
            'config.json': {
              sri: 'sha256-wronghash00000000000000000000000000000000000=',
            },
          },
        },
      },
    };

    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(badManifest, 'block', baseFetch);

    await expect(
      verifiedFetch('https://huggingface.co/Xenova/test-model/resolve/main/config.json')
    ).rejects.toThrow();
  });

  it('warns but continues on verification failure with onFail=warn', async () => {
    const badManifest: ModelVerificationManifest = {
      version: 2,
      models: {
        'Xenova/test-model': {
          baseUrl: 'https://huggingface.co/Xenova/test-model/resolve/main/',
          files: {
            'config.json': {
              sri: 'sha256-wronghash00000000000000000000000000000000000=',
            },
          },
        },
      },
    };

    const baseFetch = createMockFetch();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const verifiedFetch = createVerifiedFetch(badManifest, 'warn', baseFetch);

    const response = await verifiedFetch(
      'https://huggingface.co/Xenova/test-model/resolve/main/config.json'
    );

    // Should fall back to unverified fetch
    expect(response).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles URL input as string', async () => {
    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(manifest, 'block', baseFetch);

    const response = await verifiedFetch(
      'https://huggingface.co/Xenova/test-model/resolve/main/config.json'
    );

    expect(response).toBeDefined();
  });

  it('handles URL input as URL object', async () => {
    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(manifest, 'block', baseFetch);

    const response = await verifiedFetch(
      new URL('https://huggingface.co/Xenova/test-model/resolve/main/config.json')
    );

    expect(response).toBeDefined();
  });

  it('handles URL input as Request object', async () => {
    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(manifest, 'block', baseFetch);

    const response = await verifiedFetch(
      new Request('https://huggingface.co/Xenova/test-model/resolve/main/config.json')
    );

    expect(response).toBeDefined();
  });

  it('verifies multiple files from same model', async () => {
    const baseFetch = createMockFetch();
    const verifiedFetch = createVerifiedFetch(manifest, 'block', baseFetch);

    const configResponse = await verifiedFetch(
      'https://huggingface.co/Xenova/test-model/resolve/main/config.json'
    );
    const tokenizerResponse = await verifiedFetch(
      'https://huggingface.co/Xenova/test-model/resolve/main/tokenizer.json'
    );

    expect(configResponse.status).toBe(200);
    expect(tokenizerResponse.status).toBe(200);
  });
});

describe('isVerificationEnabled', () => {
  it('returns false initially', () => {
    // Since we cannot actually import transformers.js in tests,
    // we test the state tracking
    expect(isVerificationEnabled()).toBe(false);
  });
});
