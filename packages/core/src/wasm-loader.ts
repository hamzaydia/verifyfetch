/**
 * WASM Hasher Loader with SubtleCrypto Fallback
 *
 * Provides streaming hash computation with automatic fallback:
 * - WASM: Best for large files (streaming, constant 2MB memory)
 * - SubtleCrypto: Universal fallback (buffers data, works everywhere)
 */

import type { HashAlgorithm, StreamingHasher, SRIString } from './types.js';

// Get crypto API (works in browsers, Node 20+, and Node 18 with polyfill)
async function getCrypto(): Promise<Crypto> {
  // Try globalThis first (browsers, Node 20+)
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  // Node.js fallback - import from node:crypto
  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.webcrypto as Crypto;
  } catch {
    throw new Error('No crypto API available. Ensure you are running in a supported environment.');
  }
}

// Type definitions for the WASM module exports
interface WasmExports {
  Sha256Hasher: new () => WasmHasher;
  Sha384Hasher: new () => WasmHasher;
  Sha512Hasher: new () => WasmHasher;
  hash_sha256: (data: Uint8Array) => string;
  hash_sha384: (data: Uint8Array) => string;
  hash_sha512: (data: Uint8Array) => string;
}

interface WasmHasher {
  update(data: Uint8Array): void;
  finalize(): string;
  bytes_processed: number;
}

// Cached WASM module instance
let wasmModule: WasmExports | null = null;
let wasmInitPromise: Promise<WasmExports | null> | null = null;
let wasmAvailable: boolean | null = null;

// Track if we've shown the SubtleCrypto warning
let hasShownSubtleCryptoWarning = false;

// Threshold for warning about SubtleCrypto memory usage (50MB)
const SUBTLE_CRYPTO_WARNING_THRESHOLD = 50 * 1024 * 1024;

/**
 * Initialize the WASM module (with fallback to SubtleCrypto)
 * Returns null if WASM is not available, triggering SubtleCrypto fallback
 */
export async function initWasm(): Promise<WasmExports | null> {
  if (wasmAvailable === false) {
    return null;
  }

  if (wasmModule) {
    return wasmModule;
  }

  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = loadWasm();
  wasmModule = await wasmInitPromise;
  return wasmModule;
}

async function loadWasm(): Promise<WasmExports | null> {
  // Try multiple paths for the WASM module
  const possiblePaths = [
    // npm package structure
    '../wasm/pkg/verifyfetch_hasher.js',
    // Development structure
    './wasm/pkg/verifyfetch_hasher.js',
  ];

  for (const modulePath of possiblePaths) {
    try {
      const fullPath = new URL(modulePath, import.meta.url);
      // Dynamic import of the wasm-bindgen generated module
      const wasm = await import(/* @vite-ignore */ fullPath.href);

      // Initialize the WASM module if it has an init function
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }

      wasmAvailable = true;
      return wasm as WasmExports;
    } catch {
      continue;
    }
  }

  // WASM not available, will use SubtleCrypto fallback
  wasmAvailable = false;
  return null;
}

/**
 * SubtleCrypto fallback hasher
 * Buffers all data and hashes at finalize() - works everywhere
 *
 * @remarks This fallback buffers the entire file in memory, unlike the WASM
 * streaming hasher which uses constant ~2MB. For files >50MB, consider
 * ensuring WASM is available for better memory efficiency.
 */
function createSubtleCryptoHasher(algorithm: HashAlgorithm): StreamingHasher {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  const algorithmMap: Record<HashAlgorithm, string> = {
    sha256: 'SHA-256',
    sha384: 'SHA-384',
    sha512: 'SHA-512',
  };

  return {
    update(data: Uint8Array): void {
      chunks.push(new Uint8Array(data));
      totalBytes += data.length;

      // Warn once when file size exceeds threshold
      if (!hasShownSubtleCryptoWarning && totalBytes > SUBTLE_CRYPTO_WARNING_THRESHOLD) {
        hasShownSubtleCryptoWarning = true;
        console.warn(
          '[VerifyFetch] Large file detected (>' +
            Math.round(SUBTLE_CRYPTO_WARNING_THRESHOLD / 1024 / 1024) +
            'MB) with SubtleCrypto fallback.\n' +
            'SubtleCrypto buffers the entire file in memory, which may cause issues.\n' +
            'For better performance with large files, ensure WASM is available.\n' +
            'Learn more: https://verifyfetch.com/docs/wasm-setup'
        );
      }
    },
    async finalize(): Promise<SRIString> {
      // Combine all chunks
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Hash with SubtleCrypto
      const cryptoApi = await getCrypto();
      const hashBuffer = await cryptoApi.subtle.digest(algorithmMap[algorithm], combined);
      const hashArray = new Uint8Array(hashBuffer);

      // Convert to base64 (works in both browser and Node.js)
      let hashBase64: string;
      if (typeof btoa === 'function') {
        hashBase64 = btoa(String.fromCharCode(...hashArray));
      } else {
        // Node.js fallback
        hashBase64 = Buffer.from(hashArray).toString('base64');
      }

      return `${algorithm}-${hashBase64}` as SRIString;
    },
    get bytes_processed(): number {
      return totalBytes;
    },
  };
}

/**
 * Create a streaming hasher for the specified algorithm
 * Uses WASM when available, falls back to SubtleCrypto
 */
export async function createHasher(algorithm: HashAlgorithm): Promise<StreamingHasher> {
  const wasm = await initWasm();

  // Fallback to SubtleCrypto if WASM not available
  if (!wasm) {
    return createSubtleCryptoHasher(algorithm);
  }

  let hasher: WasmHasher;

  switch (algorithm) {
    case 'sha256':
      hasher = new wasm.Sha256Hasher();
      break;
    case 'sha384':
      hasher = new wasm.Sha384Hasher();
      break;
    case 'sha512':
      hasher = new wasm.Sha512Hasher();
      break;
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  return {
    update(data: Uint8Array): void {
      hasher.update(data);
    },
    finalize(): SRIString {
      return hasher.finalize() as SRIString;
    },
    get bytes_processed(): number {
      return hasher.bytes_processed;
    },
  };
}

/**
 * One-shot hash function for small data
 * For large files, use createHasher() with streaming instead
 */
export async function hash(data: Uint8Array, algorithm: HashAlgorithm = 'sha256'): Promise<SRIString> {
  const wasm = await initWasm();

  // Fallback to SubtleCrypto if WASM not available
  if (!wasm) {
    const hasher = createSubtleCryptoHasher(algorithm);
    hasher.update(data);
    return hasher.finalize();
  }

  switch (algorithm) {
    case 'sha256':
      return wasm.hash_sha256(data) as SRIString;
    case 'sha384':
      return wasm.hash_sha384(data) as SRIString;
    case 'sha512':
      return wasm.hash_sha512(data) as SRIString;
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
}

/**
 * Parse an SRI string to extract the algorithm
 */
export function parseAlgorithm(sri: SRIString): HashAlgorithm {
  if (sri.startsWith('sha256-')) return 'sha256';
  if (sri.startsWith('sha384-')) return 'sha384';
  if (sri.startsWith('sha512-')) return 'sha512';

  throw new Error(
    `Invalid SRI format: "${sri}"\n` +
    `Expected format: sha256-BASE64, sha384-BASE64, or sha512-BASE64\n` +
    `Learn more: https://verifyfetch.com/docs/sri-format`
  );
}

/**
 * Validate an SRI string format
 */
export function validateSri(sri: string): sri is SRIString {
  const sriPattern = /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/;
  return sriPattern.test(sri);
}

/**
 * Check if WASM hasher is available and being used
 *
 * @returns true if WASM is available, false if using SubtleCrypto fallback
 *
 * @example
 * ```ts
 * import { isUsingWasm } from 'verifyfetch';
 *
 * if (!await isUsingWasm()) {
 *   console.warn('WASM not available, using SubtleCrypto fallback');
 * }
 * ```
 */
export async function isUsingWasm(): Promise<boolean> {
  const wasm = await initWasm();
  return wasm !== null;
}
