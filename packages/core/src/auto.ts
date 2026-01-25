/**
 * Auto-wrapper for global fetch
 *
 * Import this module to automatically wrap the global fetch() function
 * with integrity verification when a manifest or policy is present.
 *
 * @example
 * ```ts
 * import 'verifyfetch/auto';
 *
 * // fetch() is now automatically verified against the manifest
 * const res = await fetch('/engine.wasm');
 * ```
 *
 * @packageDocumentation
 */

import { createVerifyFetcher } from './fetcher.js';
import type { VFManifest, VerifiedFetcher } from './types.js';

// Configuration for auto mode
interface AutoConfig {
  manifestUrl?: string;
  manifest?: VFManifest;
  patterns?: RegExp[];
}

// Global config storage
let autoConfig: AutoConfig = {};
let verifiedFetcher: VerifiedFetcher | null = null;
let fetcherPromise: Promise<VerifiedFetcher> | null = null;
let originalFetch: typeof fetch | null = null;
let isWrapped = false;

/**
 * Configure the auto wrapper
 */
export async function configureAuto(config: AutoConfig): Promise<void> {
  autoConfig = { ...autoConfig, ...config };

  // Reinitialize the fetcher if config changes
  if (autoConfig.manifestUrl || autoConfig.manifest) {
    fetcherPromise = createVerifyFetcher({
      manifestUrl: autoConfig.manifestUrl,
      manifest: autoConfig.manifest,
    });
    verifiedFetcher = await fetcherPromise;
  }
}

/**
 * Check if a URL should be verified
 */
function shouldVerify(url: string): boolean {
  // If no manifest or fetcher, don't verify
  if (!verifiedFetcher) {
    return false;
  }

  // If patterns are specified, check against them
  if (autoConfig.patterns && autoConfig.patterns.length > 0) {
    return autoConfig.patterns.some(pattern => pattern.test(url));
  }

  // Default: verify common binary file types
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

  return defaultPatterns.some(pattern => pattern.test(url));
}

/**
 * Wrapped fetch that verifies when appropriate
 */
async function wrappedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (shouldVerify(url) && verifiedFetcher) {
    try {
      return await verifiedFetcher.fetch(url, init);
    } catch (error) {
      // If verification fails and we have the original fetch,
      // we could fall back, but for security we should not.
      // Re-throw the error.
      throw error;
    }
  }

  // Use original fetch for non-verified requests
  return originalFetch!(input, init);
}

/**
 * Enable auto-wrapping of global fetch
 */
export function enableAuto(): void {
  if (isWrapped) {
    return;
  }

  if (typeof globalThis.fetch !== 'function') {
    console.warn('[VerifyFetch] Auto mode: fetch is not available in this environment');
    return;
  }

  originalFetch = globalThis.fetch;
  globalThis.fetch = wrappedFetch;
  isWrapped = true;

  console.info(
    '[VerifyFetch] Auto mode enabled. Binary files will be verified against manifest.'
  );
}

/**
 * Disable auto-wrapping and restore original fetch
 */
export function disableAuto(): void {
  if (!isWrapped || !originalFetch) {
    return;
  }

  globalThis.fetch = originalFetch;
  originalFetch = null;
  isWrapped = false;
}

// Auto-detect manifest URL from well-known location or window config
function autoDetectConfig(): void {
  // Check for window.__VF_CONFIG__ (set by build tools)
  if (typeof window !== 'undefined' && (window as any).__VF_CONFIG__) {
    configureAuto((window as any).__VF_CONFIG__);
    return;
  }

  // Check for process.env.VF_MANIFEST_URL (Node.js)
  if (typeof process !== 'undefined' && process.env?.VF_MANIFEST_URL) {
    configureAuto({ manifestUrl: process.env.VF_MANIFEST_URL });
    return;
  }

  // Check well-known location
  const wellKnownUrl = '/vf.manifest.json';

  // Don't block on this - just try to load it
  fetch(wellKnownUrl, { method: 'HEAD' })
    .then(response => {
      if (response.ok) {
        configureAuto({ manifestUrl: wellKnownUrl });
      }
    })
    .catch(() => {
      // Manifest not found at well-known location - that's fine
    });
}

// Auto-initialize when imported
if (typeof globalThis !== 'undefined') {
  autoDetectConfig();
  enableAuto();
}
