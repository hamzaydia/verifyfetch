/**
 * Vitest setup file
 * Polyfills globals that aren't available in Node.js 18
 */

import { webcrypto } from 'node:crypto';

// Polyfill crypto for Node.js 18 (Node 20+ has it globally)
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - webcrypto is compatible with Crypto
  globalThis.crypto = webcrypto;
}

// Polyfill btoa/atob if not available
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}

if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}
