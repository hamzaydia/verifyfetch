/**
 * Manifest-Aware Verified Fetcher
 *
 * Creates a fetcher instance that automatically looks up SRI hashes
 * from a manifest file, making verification a one-liner.
 */

import type {
  VerifyFetcherOptions,
  VerifiedFetcher,
  VFManifest,
  SRIString,
} from './types.js';
import { verifyFetch } from './verify-fetch.js';

/**
 * Create a manifest-aware verified fetcher
 *
 * @example
 * ```ts
 * import { createVerifyFetcher } from 'verifyfetch';
 *
 * const vf = await createVerifyFetcher({
 *   manifestUrl: '/vf.manifest.json'
 * });
 *
 * // One-liner verified fetches
 * const wasm = await vf.arrayBuffer('/engine.wasm');
 * const model = await vf.arrayBuffer('/models/phi-3.bin');
 * ```
 */
export async function createVerifyFetcher(options: VerifyFetcherOptions = {}): Promise<VerifiedFetcher> {
  const {
    manifestUrl,
    manifest: initialManifest,
    publicKeys = [],
    policyToken,
    fetchImpl = fetch,
    baseUrl = '/',
  } = options;

  let manifest: VFManifest | null = initialManifest ?? null;
  let manifestLoadPromise: Promise<void> | null = null;

  // Load manifest on first use if URL provided
  async function ensureManifest(): Promise<VFManifest> {
    if (manifest) {
      return manifest;
    }

    if (!manifestUrl) {
      throw new Error(
        'No manifest provided. Either pass manifestUrl or manifest option.\n' +
        'Generate a manifest with: npx verifyfetch sign ./public/**/*\n' +
        'Learn more: https://verifyfetch.com/docs/manifest'
      );
    }

    if (!manifestLoadPromise) {
      manifestLoadPromise = loadManifest();
    }

    await manifestLoadPromise;
    return manifest!;
  }

  async function loadManifest(): Promise<void> {
    try {
      const response = await fetchImpl(manifestUrl!);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      manifest = await response.json() as VFManifest;

      // Validate manifest version
      if (manifest.version !== 1) {
        throw new Error(
          `Unsupported manifest version: ${manifest.version}. Expected: 1`
        );
      }
    } catch (error) {
      const err = error as Error;
      throw new Error(
        `Failed to load manifest from ${manifestUrl}: ${err.message}\n` +
        'Make sure the manifest file exists and is valid JSON.\n' +
        'Generate one with: npx verifyfetch sign ./public/**/*'
      );
    }
  }

  function resolveUrl(url: string): string {
    // If already absolute, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Resolve against baseUrl
    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    const path = url.startsWith('/') ? url.slice(1) : url;
    return base + path;
  }

  function getArtifactPath(url: string): string {
    // Extract the path portion for manifest lookup
    try {
      const urlObj = new URL(url, 'http://localhost');
      return urlObj.pathname;
    } catch {
      // If URL parsing fails, use as-is
      return url.startsWith('/') ? url : '/' + url;
    }
  }

  async function verifiedFetch(url: string, init?: RequestInit): Promise<Response> {
    const m = await ensureManifest();
    const resolvedUrl = resolveUrl(url);
    const artifactPath = getArtifactPath(url);

    // Look up the artifact in manifest
    const artifact = m.artifacts[artifactPath];

    if (!artifact) {
      // Check with manifest base prefix
      const withBase = m.base + (artifactPath.startsWith('/') ? artifactPath.slice(1) : artifactPath);
      const artifactWithBase = m.artifacts[withBase];

      if (!artifactWithBase) {
        throw new Error(
          `No manifest entry found for: ${artifactPath}\n` +
          `Available paths: ${Object.keys(m.artifacts).slice(0, 5).join(', ')}...\n\n` +
          `To add this file to the manifest:\n` +
          `  npx verifyfetch sign ${artifactPath} --out vf.manifest.json\n` +
          'Learn more: https://verifyfetch.com/docs/manifest'
        );
      }

      return verifyFetch(resolvedUrl, {
        sri: artifactWithBase.sri,
        signatureUrl: artifactWithBase.signature,
        publicKey: publicKeys[0],
        fetchImpl,
      });
    }

    return verifyFetch(resolvedUrl, {
      sri: artifact.sri,
      signatureUrl: artifact.signature,
      publicKey: publicKeys[0],
      fetchImpl,
    });
  }

  // Auto-preload manifest if URL provided
  if (manifestUrl) {
    await ensureManifest();
  }

  return {
    async preload(): Promise<void> {
      await ensureManifest();
    },

    async fetch(url: string, init?: RequestInit): Promise<Response> {
      return verifiedFetch(url, init);
    },

    async arrayBuffer(url: string, init?: RequestInit): Promise<ArrayBuffer> {
      const response = await verifiedFetch(url, init);
      return response.arrayBuffer();
    },

    async blob(url: string, init?: RequestInit): Promise<Blob> {
      const response = await verifiedFetch(url, init);
      return response.blob();
    },

    async json<T = unknown>(url: string, init?: RequestInit): Promise<T> {
      const response = await verifiedFetch(url, init);
      return response.json() as Promise<T>;
    },

    async text(url: string, init?: RequestInit): Promise<string> {
      const response = await verifiedFetch(url, init);
      return response.text();
    },

    async reloadManifest(): Promise<void> {
      manifest = null;
      manifestLoadPromise = null;
      await ensureManifest();
    },
  };
}

/**
 * Parse a manifest file content
 */
export function parseManifest(content: string): VFManifest {
  try {
    const manifest = JSON.parse(content) as VFManifest;

    if (typeof manifest !== 'object' || manifest === null) {
      throw new Error('Manifest must be an object');
    }

    if (manifest.version !== 1) {
      throw new Error(`Unsupported manifest version: ${manifest.version}`);
    }

    if (typeof manifest.artifacts !== 'object') {
      throw new Error('Manifest must have an artifacts object');
    }

    return manifest;
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Invalid manifest format: ${err.message}\n` +
      'Expected format:\n' +
      '{\n' +
      '  "version": 1,\n' +
      '  "base": "/",\n' +
      '  "artifacts": { "/path": { "sri": "sha256-..." } }\n' +
      '}'
    );
  }
}

/**
 * Create an empty manifest
 */
export function createManifest(base: string = '/'): VFManifest {
  return {
    version: 1,
    base,
    artifacts: {},
  };
}

/**
 * Add an artifact to a manifest
 */
export function addArtifact(
  manifest: VFManifest,
  path: string,
  sri: SRIString,
  signature?: string
): VFManifest {
  return {
    ...manifest,
    artifacts: {
      ...manifest.artifacts,
      [path]: {
        sri,
        ...(signature && { signature }),
      },
    },
  };
}
