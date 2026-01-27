/**
 * Content-Addressable URLs for VerifyFetch
 *
 * Enables hash-based URLs that work with any source, providing automatic
 * multi-CDN failover and content verification by URL.
 *
 * @example
 * ```typescript
 * import { verifyFetchFromSources } from 'verifyfetch';
 *
 * // The hash IS the verification - fetch from any source
 * const response = await verifyFetchFromSources(
 *   'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
 *   '/model.bin',
 *   {
 *     sources: [
 *       'https://cdn1.example.com',
 *       'https://cdn2.example.com',
 *       'https://backup.example.com'
 *     ]
 *   }
 * );
 * ```
 */

import type { SRIString, VerifyFetchOptions } from './types.js';
import { IntegrityError } from './types.js';
import { verifyFetch, verifyFetchStream } from './verify-fetch.js';

/**
 * Options for multi-source fetching
 */
export interface MultiSourceOptions {
  /**
   * Array of base URLs to try
   * Will try each source in order until one succeeds
   */
  sources: string[];

  /**
   * Fetch strategy
   * - 'sequential': Try sources one by one (default)
   * - 'race': Try all sources simultaneously, use first success
   * - 'fastest': Try all sources, use fastest successful response
   */
  strategy?: 'sequential' | 'race' | 'fastest';

  /**
   * Timeout per source in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Progress callback
   */
  onProgress?: (bytes: number, total?: number) => void;

  /**
   * Callback when a source fails
   */
  onSourceError?: (source: string, error: Error) => void;

  /**
   * Custom fetch implementation
   */
  fetchImpl?: typeof fetch;
}

/**
 * Parse a content-addressable URL
 *
 * Format: vf://{algorithm}/{hash}/{path}
 *
 * @example
 * ```typescript
 * const { sri, path } = parseContentAddressableUrl(
 *   'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin'
 * );
 * // sri = 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
 * // path = '/model.bin'
 * ```
 */
export function parseContentAddressableUrl(url: string): { sri: SRIString; path: string } | null {
  // Handle vf:// protocol
  if (url.startsWith('vf://')) {
    const withoutProtocol = url.slice(5);
    const parts = withoutProtocol.split('/');

    if (parts.length < 3) {
      return null;
    }

    const algorithm = parts[0];
    if (!['sha256', 'sha384', 'sha512'].includes(algorithm)) {
      return null;
    }

    const hash = parts[1];
    const path = '/' + parts.slice(2).join('/');

    return {
      sri: `${algorithm}-${hash}` as SRIString,
      path,
    };
  }

  return null;
}

/**
 * Create a content-addressable URL from an SRI hash and path
 *
 * @example
 * ```typescript
 * const url = createContentAddressableUrl(
 *   'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=',
 *   '/model.bin'
 * );
 * // 'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin'
 * ```
 */
export function createContentAddressableUrl(sri: SRIString, path: string): string {
  const [algorithm, hash] = sri.split('-');
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `vf://${algorithm}/${hash}/${cleanPath}`;
}

/**
 * Fetch and verify from multiple sources
 *
 * Tries each source in order until verification succeeds.
 *
 * @example
 * ```typescript
 * const response = await verifyFetchFromSources(
 *   'sha256-abc123...',
 *   '/model.bin',
 *   {
 *     sources: ['https://cdn1.com', 'https://cdn2.com'],
 *     strategy: 'race'
 *   }
 * );
 * ```
 */
export async function verifyFetchFromSources(
  sri: SRIString,
  path: string,
  options: MultiSourceOptions
): Promise<Response> {
  const {
    sources,
    strategy = 'sequential',
    timeout = 30000,
    onProgress,
    onSourceError,
    fetchImpl = fetch,
  } = options;

  if (sources.length === 0) {
    throw new Error('At least one source URL is required');
  }

  const fetchOptions: VerifyFetchOptions = {
    sri,
    onProgress,
    fetchImpl,
    onFail: 'block',
  };

  switch (strategy) {
    case 'sequential':
      return fetchSequential(sources, path, fetchOptions, timeout, onSourceError);
    case 'race':
      return fetchRace(sources, path, fetchOptions, timeout);
    case 'fastest':
      return fetchFastest(sources, path, fetchOptions, timeout);
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Try sources sequentially until one succeeds
 */
async function fetchSequential(
  sources: string[],
  path: string,
  options: VerifyFetchOptions,
  timeout: number,
  onSourceError?: (source: string, error: Error) => void
): Promise<Response> {
  const errors: Error[] = [];

  for (const source of sources) {
    const url = buildUrl(source, path);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await verifyFetch(url, {
        ...options,
        fetchImpl: (input, init) => {
          return (options.fetchImpl ?? fetch)(input, {
            ...init,
            signal: controller.signal,
          });
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);

      if (onSourceError) {
        onSourceError(source, err);
      }
    }
  }

  throw new AggregateError(
    errors,
    `All ${sources.length} sources failed for ${path}`
  );
}

/**
 * Try all sources simultaneously, use first success
 */
async function fetchRace(
  sources: string[],
  path: string,
  options: VerifyFetchOptions,
  timeout: number
): Promise<Response> {
  const controllers = sources.map(() => new AbortController());

  const promises = sources.map((source, index) => {
    const url = buildUrl(source, path);
    const controller = controllers[index];

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return verifyFetch(url, {
      ...options,
      fetchImpl: (input, init) => {
        return (options.fetchImpl ?? fetch)(input, {
          ...init,
          signal: controller.signal,
        });
      },
    }).then((response) => {
      clearTimeout(timeoutId);
      // Abort other requests
      controllers.forEach((c, i) => {
        if (i !== index) c.abort();
      });
      return response;
    });
  });

  try {
    return await Promise.any(promises);
  } catch (error) {
    if (error instanceof AggregateError) {
      throw new AggregateError(
        error.errors,
        `All ${sources.length} sources failed for ${path}`
      );
    }
    throw error;
  }
}

/**
 * Try all sources, use fastest successful response
 * (Same as race for our purposes since we need verified responses)
 */
async function fetchFastest(
  sources: string[],
  path: string,
  options: VerifyFetchOptions,
  timeout: number
): Promise<Response> {
  // For verified fetches, "fastest" is effectively the same as "race"
  // because we need the complete verified response
  return fetchRace(sources, path, options, timeout);
}

/**
 * Build a full URL from base and path
 */
function buildUrl(base: string, path: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return cleanBase + cleanPath;
}

/**
 * Resolve a vf:// URL with the given sources
 *
 * @example
 * ```typescript
 * const response = await resolveContentAddressable(
 *   'vf://sha256/abc123.../model.bin',
 *   ['https://cdn1.com', 'https://cdn2.com']
 * );
 * ```
 */
export async function resolveContentAddressable(
  vfUrl: string,
  sources: string[],
  options?: Omit<MultiSourceOptions, 'sources'>
): Promise<Response> {
  const parsed = parseContentAddressableUrl(vfUrl);

  if (!parsed) {
    throw new Error(`Invalid vf:// URL: ${vfUrl}`);
  }

  return verifyFetchFromSources(parsed.sri, parsed.path, {
    ...options,
    sources,
  });
}
