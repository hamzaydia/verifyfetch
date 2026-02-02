/**
 * Hub Interceptor
 *
 * Intercept all Transformers.js model downloads globally by setting
 * env.fetch on the Transformers.js environment. All fetches for files
 * in the manifest are verified; others pass through unchanged.
 */

import { verifyFetch, type SRIString } from 'verifyfetch';
import type {
  ModelVerificationManifest,
  VerificationConfig,
} from './types.js';
import { ManifestError } from './types.js';
import { loadModelManifest, lookupSriByUrl } from './model-manifest.js';

/** Track the original fetch so we can restore it */
let originalFetch: typeof fetch | null = null;
let isEnabled = false;

/**
 * Enable global verification for all Transformers.js model downloads.
 *
 * Sets `env.fetch` on the Transformers.js environment so that every
 * model file download is automatically verified against the manifest.
 * Files not in the manifest pass through to normal fetch.
 *
 * @param config - Verification configuration with manifest URL or inline manifest
 *
 * @example
 * ```ts
 * import { enableVerification } from '@verifyfetch/transformers';
 *
 * await enableVerification({
 *   manifestUrl: '/models/vf-hf.manifest.json'
 * });
 *
 * // Now ALL Transformers.js pipeline() calls are verified automatically
 * import { pipeline } from '@huggingface/transformers';
 * const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
 * ```
 */
export async function enableVerification(
  config: VerificationConfig & {
    /** Custom fetch to use as the base (before verification wrapping) */
    fetchImpl?: typeof fetch;
  }
): Promise<void> {
  if (isEnabled) {
    throw new Error(
      'Verification is already enabled. Call disableVerification() first before re-enabling.'
    );
  }

  if (!config.manifest && !config.manifestUrl) {
    throw new ManifestError('Either manifest or manifestUrl must be provided');
  }

  // Load manifest
  const manifest = config.manifest ?? await loadModelManifest(
    config.manifestUrl!,
    config.fetchImpl
  );

  const onFail = config.onFail ?? 'block';

  // Import Transformers.js env
  const transformersEnv = await importTransformersEnv();
  if (!transformersEnv) {
    throw new Error(
      '@huggingface/transformers is required but not installed.\n' +
      'Install it with: npm install @huggingface/transformers'
    );
  }

  // Save original fetch so we can restore it
  originalFetch = transformersEnv.env.fetch ?? null;
  const baseFetch = config.fetchImpl ?? originalFetch ?? globalThis.fetch;

  // Set verified fetch on the Transformers.js environment
  transformersEnv.env.fetch = createVerifiedFetch(manifest, onFail, baseFetch);
  isEnabled = true;
}

/**
 * Disable global verification and restore the original fetch behavior.
 *
 * @example
 * ```ts
 * import { enableVerification, disableVerification } from '@verifyfetch/transformers';
 *
 * await enableVerification({ manifestUrl: '/manifest.json' });
 * // ... use Transformers.js with verification ...
 * await disableVerification();
 * ```
 */
export async function disableVerification(): Promise<void> {
  if (!isEnabled) return;

  const transformersEnv = await importTransformersEnv();
  if (transformersEnv) {
    if (originalFetch) {
      transformersEnv.env.fetch = originalFetch;
    } else {
      delete (transformersEnv.env as Record<string, unknown>).fetch;
    }
  }

  originalFetch = null;
  isEnabled = false;
}

/**
 * Check if global verification is currently enabled
 */
export function isVerificationEnabled(): boolean {
  return isEnabled;
}

/**
 * Create a verified fetch function that wraps the base fetch.
 * Looks up each URL in the manifest — if found, verifies; otherwise passes through.
 *
 * This is also exported for use in verifiedPipeline() and testing.
 */
export function createVerifiedFetch(
  manifest: ModelVerificationManifest,
  onFail: 'block' | 'warn',
  baseFetch: typeof fetch = globalThis.fetch
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    // Look up the URL in the manifest
    const match = lookupSriByUrl(url, manifest);

    if (!match) {
      // Not in manifest — pass through unverified
      return baseFetch(input, init);
    }

    // Found in manifest — verify the download
    try {
      return await verifyFetch(url, {
        sri: match.fileInfo.sri as SRIString,
        onFail: onFail === 'warn' ? 'warn' : 'block',
        fetchImpl: (fetchInput, fetchInit) =>
          baseFetch(fetchInput, { ...init, ...fetchInit }),
      });
    } catch (error) {
      if (onFail === 'warn') {
        console.warn(
          `[verifyfetch/transformers] Verification failed for ${match.modelId}/${match.filename}:`,
          error
        );
        return baseFetch(input, init);
      }
      throw error;
    }
  };
}

/**
 * Import the Transformers.js env module dynamically.
 * Transformers.js v3+ uses env.fetch (not env.customFetch).
 */
async function importTransformersEnv(): Promise<{
  env: {
    fetch: typeof fetch | undefined;
    [key: string]: unknown;
  };
} | null> {
  try {
    const module = await import('@huggingface/transformers');
    return module as unknown as {
      env: {
        fetch: typeof fetch | undefined;
        [key: string]: unknown;
      };
    };
  } catch {
    return null;
  }
}
