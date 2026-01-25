/**
 * Tests for Types and Errors
 */

import { describe, it, expect } from 'vitest';
import { IntegrityError, SignatureError } from './types.js';
import type { SRIString } from './types.js';

describe('IntegrityError', () => {
  it('should create error with correct properties', () => {
    const error = new IntegrityError(
      '/test.wasm',
      'sha256-expected123' as SRIString,
      'sha256-actual456' as SRIString
    );

    expect(error.name).toBe('IntegrityError');
    expect(error.url).toBe('/test.wasm');
    expect(error.expectedSri).toBe('sha256-expected123');
    expect(error.actualSri).toBe('sha256-actual456');
  });

  it('should include helpful message', () => {
    const error = new IntegrityError(
      '/test.wasm',
      'sha256-expected123' as SRIString,
      'sha256-actual456' as SRIString
    );

    expect(error.message).toContain('/test.wasm');
    expect(error.message).toContain('sha256-expected123');
    expect(error.message).toContain('sha256-actual456');
    expect(error.message).toContain('verifyfetch.com');
  });

  it('should be instanceof Error', () => {
    const error = new IntegrityError(
      '/test.wasm',
      'sha256-a' as SRIString,
      'sha256-b' as SRIString
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(IntegrityError);
  });
});

describe('SignatureError', () => {
  it('should create error with correct properties', () => {
    const error = new SignatureError('/test.wasm', 'Invalid signature format');

    expect(error.name).toBe('SignatureError');
    expect(error.url).toBe('/test.wasm');
  });

  it('should include helpful message', () => {
    const error = new SignatureError('/test.wasm', 'Key not found');

    expect(error.message).toContain('/test.wasm');
    expect(error.message).toContain('Key not found');
    expect(error.message).toContain('verifyfetch.com');
  });

  it('should be instanceof Error', () => {
    const error = new SignatureError('/test.wasm', 'test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SignatureError);
  });
});
