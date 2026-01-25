/**
 * Core VerifyFetch Implementation
 *
 * Provides streaming integrity verification for fetch() responses.
 * Uses WASM for memory-efficient hashing of multi-GB files.
 */

import type {
  VerifyFetchOptions,
  SRIString,
  OnFailBehavior,
  StreamingHasher,
} from './types.js';
import { IntegrityError } from './types.js';
import { createHasher, parseAlgorithm, validateSri } from './wasm-loader.js';

// First-run message (shows once per session)
let hasShownWelcome = false;

function showWelcomeOnce(): void {
  if (hasShownWelcome) return;
  hasShownWelcome = true;

  // Only show in development/debug mode
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return;
  }

  console.info(
    '%c[VerifyFetch]%c Protecting your assets. ' +
    'Star us: https://github.com/hamzaydia/verifyfetch',
    'color: #10b981; font-weight: bold',
    'color: inherit'
  );
}

/**
 * Fetch and verify a resource against an SRI hash
 *
 * @example
 * ```ts
 * import { verifyFetch } from 'verifyfetch';
 *
 * // Basic integrity check
 * const res = await verifyFetch('/models/phi-3.bin', {
 *   sri: 'sha256-abc123...'
 * });
 * const model = await res.arrayBuffer();
 *
 * // With fallback URL
 * const wasm = await verifyFetch('/engine.wasm', {
 *   sri: 'sha256-xyz789...',
 *   onFail: { fallbackUrl: '/backup/engine.wasm' }
 * });
 * ```
 */
export async function verifyFetch(
  url: string | URL,
  options: VerifyFetchOptions
): Promise<Response> {
  showWelcomeOnce();

  const {
    sri,
    onFail = 'block',
    fetchImpl = fetch,
    onProgress,
  } = options;

  // Validate SRI format
  if (!validateSri(sri)) {
    throw new Error(
      `Invalid SRI format: "${sri}"\n` +
      `Expected: sha256-BASE64, sha384-BASE64, or sha512-BASE64\n` +
      `Example: sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=\n\n` +
      `Generate one with: npx verifyfetch sign ${url}\n` +
      `Learn more: https://verifyfetch.com/docs/sri-format`
    );
  }

  const urlString = url.toString();
  const algorithm = parseAlgorithm(sri);

  // Fetch the resource
  const response = await fetchImpl(urlString);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${urlString}: ${response.status} ${response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error(
      `Response body is null for ${urlString}. ` +
      `This might be a browser/runtime limitation.`
    );
  }

  // Get total size for progress reporting
  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

  // Create streaming hasher
  const hasher = await createHasher(algorithm);

  // Create a TransformStream that hashes chunks as they pass through
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      hasher.update(chunk);

      if (onProgress) {
        onProgress(hasher.bytes_processed, totalBytes);
      }

      controller.enqueue(chunk);
    },
  });

  // Pipe the response through the hashing transform
  const streamPromise = response.body.pipeTo(writable);

  // Create a new response with the verified stream
  // We need to collect all chunks to verify before returning
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(result.value);
    }
  }

  // Wait for the stream to complete
  await streamPromise;

  // Verify the hash
  const actualSri = await hasher.finalize();

  if (actualSri !== sri) {
    return handleVerificationFailure(
      urlString,
      sri,
      actualSri,
      onFail,
      options,
      chunks
    );
  }

  // Create a new Response with the verified data
  const verifiedData = concatenateChunks(chunks);
  return new Response(verifiedData.buffer as ArrayBuffer, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Verify a stream or async iterable against an SRI hash
 *
 * @example
 * ```ts
 * import { verifyStream } from 'verifyfetch';
 *
 * const stream = fs.createReadStream('large-file.bin');
 * const verified = await verifyStream(stream, {
 *   sri: 'sha256-abc123...'
 * });
 * ```
 */
export async function verifyStream(
  input: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
  options: { sri: SRIString; onProgress?: (bytes: number) => void }
): Promise<Uint8Array> {
  const { sri, onProgress } = options;

  if (!validateSri(sri)) {
    throw new Error(`Invalid SRI format: "${sri}"`);
  }

  const algorithm = parseAlgorithm(sri);
  const hasher = await createHasher(algorithm);
  const chunks: Uint8Array[] = [];

  // Handle both ReadableStream and AsyncIterable
  if ('getReader' in input) {
    // ReadableStream
    const reader = input.getReader();
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        hasher.update(result.value);
        chunks.push(result.value);
        if (onProgress) {
          onProgress(hasher.bytes_processed);
        }
      }
    }
  } else {
    // AsyncIterable
    for await (const chunk of input) {
      hasher.update(chunk);
      chunks.push(chunk);
      if (onProgress) {
        onProgress(hasher.bytes_processed);
      }
    }
  }

  const actualSri = await hasher.finalize();

  if (actualSri !== sri) {
    throw new IntegrityError('stream', sri, actualSri);
  }

  return concatenateChunks(chunks);
}

/**
 * Handle verification failure based on onFail behavior
 */
async function handleVerificationFailure(
  url: string,
  expectedSri: SRIString,
  actualSri: SRIString,
  onFail: OnFailBehavior,
  options: VerifyFetchOptions,
  chunks: Uint8Array[]
): Promise<Response> {
  if (onFail === 'warn') {
    console.warn(
      `[VerifyFetch] Integrity mismatch for ${url}\n` +
      `  Expected: ${expectedSri}\n` +
      `  Actual:   ${actualSri}\n` +
      `  Continuing anyway (onFail: 'warn')`
    );

    // Return the data anyway
    return new Response(concatenateChunks(chunks).buffer as ArrayBuffer);
  }

  if (typeof onFail === 'object' && onFail.fallbackUrl) {
    console.warn(
      `[VerifyFetch] Integrity mismatch for ${url}\n` +
      `  Expected: ${expectedSri}\n` +
      `  Actual:   ${actualSri}\n` +
      `  Trying fallback: ${onFail.fallbackUrl}`
    );

    // Try the fallback URL
    return verifyFetch(onFail.fallbackUrl, {
      ...options,
      onFail: 'block', // Don't recurse into more fallbacks
    });
  }

  // Default: block
  throw new IntegrityError(url, expectedSri, actualSri);
}

/**
 * Concatenate multiple Uint8Arrays into one
 */
function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) {
    return new Uint8Array(0);
  }

  if (chunks.length === 1) {
    return chunks[0];
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Utility to compute the SRI hash of data
 * Useful for generating hashes for the manifest
 */
export async function computeSri(
  data: Uint8Array | ArrayBuffer,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'
): Promise<SRIString> {
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const hasher = await createHasher(algorithm);
  hasher.update(input);
  return await hasher.finalize();
}
