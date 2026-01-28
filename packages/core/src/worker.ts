/**
 * Service Worker Integration for VerifyFetch
 *
 * Enables zero-code integrity verification by intercepting fetch requests
 * in a Service Worker.
 *
 * @example
 * ```typescript
 * // In your service-worker.js:
 * import { createVerifyWorker } from 'verifyfetch/worker';
 *
 * createVerifyWorker({
 *   manifestUrl: '/vf.manifest.json'
 * });
 *
 * // In your app - no changes needed:
 * const model = await fetch('/model.bin');  // Automatically verified!
 * ```
 */

import type { SRIString, VFManifest, VFManifestV2, VFManifestAny } from './types.js';
import { verifyFetchStream } from './verify-fetch.js';

/**
 * Options for Service Worker verification
 */
export interface VerifyWorkerOptions {
  /**
   * URL to the manifest file
   */
  manifestUrl: string;

  /**
   * Glob patterns for files to verify
   * @default ['*.wasm', '*.bin', '*.onnx', '*.safetensors', '*.gguf']
   */
  include?: string[];

  /**
   * Glob patterns for files to exclude
   * @default []
   */
  exclude?: string[];

  /**
   * What to do when verification fails
   * @default 'block'
   */
  onFail?: 'block' | 'warn' | 'passthrough';

  /**
   * Cache verified responses
   * @default true
   */
  cacheVerified?: boolean;

  /**
   * Cache name for verified responses
   * @default 'verifyfetch-verified'
   */
  cacheName?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

// Default patterns for binary files that should be verified
const DEFAULT_INCLUDE_PATTERNS = [
  '*.wasm',
  '*.bin',
  '*.onnx',
  '*.safetensors',
  '*.gguf',
  '*.weights',
  '*.model',
];

/**
 * State for the verify worker
 */
interface WorkerState {
  manifest: VFManifestAny | null;
  options: Required<VerifyWorkerOptions>;
  initialized: boolean;
}

let workerState: WorkerState | null = null;

/**
 * Create and configure the VerifyFetch Service Worker
 *
 * Call this in your service-worker.js file. It will intercept fetch requests
 * and verify them against the manifest.
 *
 * @example
 * ```typescript
 * // sw.js
 * import { createVerifyWorker } from 'verifyfetch/worker';
 *
 * createVerifyWorker({
 *   manifestUrl: '/vf.manifest.json',
 *   include: ['*.wasm', '*.bin'],
 *   onFail: 'block'
 * });
 * ```
 */
export function createVerifyWorker(options: VerifyWorkerOptions): void {
  const resolvedOptions: Required<VerifyWorkerOptions> = {
    manifestUrl: options.manifestUrl,
    include: options.include ?? DEFAULT_INCLUDE_PATTERNS,
    exclude: options.exclude ?? [],
    onFail: options.onFail ?? 'block',
    cacheVerified: options.cacheVerified ?? true,
    cacheName: options.cacheName ?? 'verifyfetch-verified',
    debug: options.debug ?? false,
  };

  workerState = {
    manifest: null,
    options: resolvedOptions,
    initialized: false,
  };

  // Set up the fetch event listener
  // Using type assertions for Service Worker event types
  (self as unknown as ServiceWorkerGlobalScope).addEventListener(
    'fetch',
    handleFetchEvent
  );

  // Load manifest on first fetch or install
  (self as unknown as ServiceWorkerGlobalScope).addEventListener(
    'install',
    handleInstallEvent as (event: ExtendableEvent) => void
  );
  (self as unknown as ServiceWorkerGlobalScope).addEventListener(
    'activate',
    handleActivateEvent as (event: ExtendableEvent) => void
  );

  if (resolvedOptions.debug) {
    console.log('[VerifyFetch] Service Worker initialized', resolvedOptions);
  }
}

/**
 * Handle Service Worker install event
 */
function handleInstallEvent(event: ExtendableEvent): void {
  event.waitUntil(loadManifest());
}

/**
 * Handle Service Worker activate event
 */
function handleActivateEvent(event: ExtendableEvent): void {
  // Claim all clients immediately
  event.waitUntil((self as unknown as ServiceWorkerGlobalScope).clients.claim());
}

/**
 * Handle fetch events
 */
function handleFetchEvent(event: FetchEvent): void {
  if (!workerState) return;

  const url = new URL(event.request.url);

  // Only intercept same-origin requests or check patterns
  if (!shouldVerify(url.pathname, workerState.options)) {
    return;
  }

  event.respondWith(handleVerifiedFetch(event.request));
}

/**
 * Check if a URL should be verified based on include/exclude patterns
 */
function shouldVerify(pathname: string, options: Required<VerifyWorkerOptions>): boolean {
  // Check exclude patterns first
  for (const pattern of options.exclude) {
    if (matchGlob(pathname, pattern)) {
      return false;
    }
  }

  // Check include patterns
  for (const pattern of options.include) {
    if (matchGlob(pathname, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple glob matching (supports * and ** wildcards)
 */
function matchGlob(path: string, pattern: string): boolean {
  // Handle *.ext patterns
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1); // .wasm, .bin, etc.
    return path.endsWith(ext);
  }

  // Handle exact matches
  if (!pattern.includes('*')) {
    return path === pattern || path.endsWith('/' + pattern);
  }

  // Convert glob to regex
  // Handle **/ patterns (zero or more directory levels)
  let regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(?:.*\\/)?') // **/ matches zero or more directories
    .replace(/\*\*/g, '.*') // ** alone matches anything
    .replace(/\*/g, '[^/]*'); // * matches anything except /

  return new RegExp(`^${regexPattern}$`).test(path);
}

/**
 * Perform verified fetch
 */
async function handleVerifiedFetch(request: Request): Promise<Response> {
  if (!workerState) {
    return fetch(request);
  }

  const options = workerState.options;
  const url = new URL(request.url);

  // Ensure manifest is loaded
  if (!workerState.manifest) {
    await loadManifest();
  }

  // Check cache first
  if (options.cacheVerified) {
    const cached = await getCachedResponse(request, options.cacheName);
    if (cached) {
      if (options.debug) {
        console.log('[VerifyFetch] Cache hit:', url.pathname);
      }
      return cached;
    }
  }

  // Look up SRI in manifest
  const sri = lookupSri(url.pathname, workerState.manifest);

  if (!sri) {
    if (options.debug) {
      console.log('[VerifyFetch] No SRI found, passing through:', url.pathname);
    }
    return fetch(request);
  }

  if (options.debug) {
    console.log('[VerifyFetch] Verifying:', url.pathname);
  }

  try {
    // Use streaming verification
    const { stream, verified, totalBytes } = await verifyFetchStream(request.url, {
      sri,
      onFail: options.onFail === 'block' ? 'block' : 'warn',
    });

    // Create response from verified stream
    const response = new Response(stream, {
      headers: {
        'Content-Type': getContentType(url.pathname),
        ...(totalBytes ? { 'Content-Length': String(totalBytes) } : {}),
      },
    });

    // Wait for verification to complete before caching
    verified.then(async () => {
      if (options.cacheVerified) {
        // Clone and cache the verified response
        const responseToCache = response.clone();
        const cache = await caches.open(options.cacheName);
        await cache.put(request, responseToCache);
      }
    }).catch((error) => {
      if (options.debug) {
        console.error('[VerifyFetch] Verification failed:', url.pathname, error);
      }
    });

    return response;
  } catch (error) {
    if (options.onFail === 'passthrough') {
      if (options.debug) {
        console.warn('[VerifyFetch] Verification failed, passing through:', url.pathname);
      }
      return fetch(request);
    }

    throw error;
  }
}

/**
 * Load the manifest from the configured URL
 */
async function loadManifest(): Promise<void> {
  if (!workerState) return;

  try {
    const response = await fetch(workerState.options.manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }

    workerState.manifest = await response.json();
    workerState.initialized = true;

    if (workerState.options.debug) {
      const artifactCount = Object.keys(workerState.manifest?.artifacts ?? {}).length;
      console.log(`[VerifyFetch] Manifest loaded: ${artifactCount} artifacts`);
    }
  } catch (error) {
    console.error('[VerifyFetch] Failed to load manifest:', error);
  }
}

/**
 * Look up SRI hash in manifest
 */
function lookupSri(pathname: string, manifest: VFManifestAny | null): SRIString | null {
  if (!manifest) return null;

  const artifact = manifest.artifacts[pathname];
  if (!artifact) return null;

  // Handle both v1 and v2 manifest formats
  return artifact.sri ?? null;
}

/**
 * Get cached response
 */
async function getCachedResponse(request: Request, cacheName: string): Promise<Response | null> {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached ?? null;
  } catch {
    return null;
  }
}

/**
 * Get content type for a file path
 */
function getContentType(pathname: string): string {
  const ext = pathname.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    wasm: 'application/wasm',
    bin: 'application/octet-stream',
    onnx: 'application/octet-stream',
    safetensors: 'application/octet-stream',
    gguf: 'application/octet-stream',
    json: 'application/json',
    txt: 'text/plain',
  };
  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}

/**
 * Register a Service Worker with VerifyFetch support
 *
 * Call this from your main application to register the Service Worker.
 *
 * @example
 * ```typescript
 * // In your app entry point:
 * import { registerVerifyWorker } from 'verifyfetch/worker';
 *
 * await registerVerifyWorker('/sw.js');
 * ```
 */
export async function registerVerifyWorker(
  swUrl: string,
  options?: RegistrationOptions
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[VerifyFetch] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl, options);

    // Wait for the service worker to be active
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', function handler() {
          if (this.state === 'activated') {
            this.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
    }

    console.log('[VerifyFetch] Service Worker registered');
    return registration;
  } catch (error) {
    console.error('[VerifyFetch] Service Worker registration failed:', error);
    return null;
  }
}
