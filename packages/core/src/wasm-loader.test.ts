/**
 * Tests for WASM Loader utilities
 */

import { describe, it, expect } from 'vitest';
import { validateSri, parseAlgorithm } from './wasm-loader.js';
import type { SRIString, HashAlgorithm } from './types.js';

describe('validateSri', () => {
  it('should validate correct SHA-256 SRI strings', () => {
    expect(validateSri('sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=')).toBe(true);
    expect(validateSri('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')).toBe(true);
  });

  it('should validate correct SHA-384 SRI strings', () => {
    expect(validateSri('sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb')).toBe(true);
  });

  it('should validate correct SHA-512 SRI strings', () => {
    expect(validateSri('sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==')).toBe(true);
  });

  it('should reject invalid SRI strings', () => {
    expect(validateSri('')).toBe(false);
    expect(validateSri('sha256')).toBe(false);
    expect(validateSri('sha256-')).toBe(false);
    expect(validateSri('md5-abc123')).toBe(false);
    expect(validateSri('sha128-abc123')).toBe(false);
    expect(validateSri('sha256-invalid!chars')).toBe(false);
    expect(validateSri('SHA256-lowercase')).toBe(false);
  });
});

describe('parseAlgorithm', () => {
  it('should parse SHA-256 algorithm', () => {
    expect(parseAlgorithm('sha256-abc123' as SRIString)).toBe('sha256');
  });

  it('should parse SHA-384 algorithm', () => {
    expect(parseAlgorithm('sha384-abc123' as SRIString)).toBe('sha384');
  });

  it('should parse SHA-512 algorithm', () => {
    expect(parseAlgorithm('sha512-abc123' as SRIString)).toBe('sha512');
  });

  it('should throw for invalid algorithms', () => {
    expect(() => parseAlgorithm('md5-abc123' as SRIString)).toThrow();
    expect(() => parseAlgorithm('sha128-abc123' as SRIString)).toThrow();
  });
});
