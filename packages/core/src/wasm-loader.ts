/**
 * WASM Hasher Loader
 *
 * Handles loading and initialization of the WASM streaming hasher module.
 * Provides a unified interface for creating hashers regardless of algorithm.
 */

import type { HashAlgorithm, StreamingHasher, SRIString } from './types.js';

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
let wasmInitPromise: Promise<WasmExports> | null = null;

/**
 * Initialize the WASM module
 * This is called automatically on first use, but can be called explicitly
 * to preload the module for faster first-use latency.
 */
export async function initWasm(): Promise<WasmExports> {
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

async function loadWasm(): Promise<WasmExports> {
  // Try multiple paths for the WASM module
  const possiblePaths = [
    // npm package structure
    new URL('../wasm/pkg/verifyfetch_hasher.js', import.meta.url),
    // Development structure
    new URL('./wasm/pkg/verifyfetch_hasher.js', import.meta.url),
  ];

  let lastError: Error | null = null;

  for (const modulePath of possiblePaths) {
    try {
      // Dynamic import of the wasm-bindgen generated module
      const wasm = await import(/* @vite-ignore */ modulePath.href);

      // Initialize the WASM module if it has an init function
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }

      return wasm as WasmExports;
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }

  throw new Error(
    `Failed to load VerifyFetch WASM module. ` +
    `Last error: ${lastError?.message}\n\n` +
    `Make sure the WASM module is built: pnpm build:wasm\n` +
    `Learn more: https://verifyfetch.com/docs/wasm-setup`
  );
}

/**
 * Create a streaming hasher for the specified algorithm
 */
export async function createHasher(algorithm: HashAlgorithm): Promise<StreamingHasher> {
  const wasm = await initWasm();

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
