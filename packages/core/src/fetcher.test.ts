/**
 * Tests for Manifest Fetcher
 */

import { describe, it, expect } from 'vitest';
import { parseManifest, createManifest, addArtifact } from './fetcher.js';
import type { VFManifest, SRIString } from './types.js';

describe('parseManifest', () => {
  it('should parse valid manifest', () => {
    const content = JSON.stringify({
      version: 1,
      base: '/',
      artifacts: {
        '/engine.wasm': { sri: 'sha256-abc123' },
        '/model.bin': { sri: 'sha384-xyz789' },
      },
    });

    const manifest = parseManifest(content);

    expect(manifest.version).toBe(1);
    expect(manifest.base).toBe('/');
    expect(manifest.artifacts['/engine.wasm'].sri).toBe('sha256-abc123');
    expect(manifest.artifacts['/model.bin'].sri).toBe('sha384-xyz789');
  });

  it('should parse manifest with signatures', () => {
    const content = JSON.stringify({
      version: 1,
      base: '/assets',
      artifacts: {
        '/engine.wasm': {
          sri: 'sha256-abc123',
          signature: '/engine.wasm.sig',
          issuer: 'self',
        },
      },
    });

    const manifest = parseManifest(content);

    expect(manifest.artifacts['/engine.wasm'].signature).toBe('/engine.wasm.sig');
    expect(manifest.artifacts['/engine.wasm'].issuer).toBe('self');
  });

  it('should reject invalid JSON', () => {
    expect(() => parseManifest('not json')).toThrow();
    expect(() => parseManifest('{')).toThrow();
  });

  it('should reject invalid version', () => {
    const content = JSON.stringify({
      version: 2,
      base: '/',
      artifacts: {},
    });

    expect(() => parseManifest(content)).toThrow('version');
  });

  it('should reject non-object', () => {
    expect(() => parseManifest('"string"')).toThrow();
    expect(() => parseManifest('123')).toThrow();
    expect(() => parseManifest('null')).toThrow();
  });
});

describe('createManifest', () => {
  it('should create empty manifest with default base', () => {
    const manifest = createManifest();

    expect(manifest.version).toBe(1);
    expect(manifest.base).toBe('/');
    expect(manifest.artifacts).toEqual({});
  });

  it('should create empty manifest with custom base', () => {
    const manifest = createManifest('/assets');

    expect(manifest.base).toBe('/assets');
  });
});

describe('addArtifact', () => {
  it('should add artifact to manifest', () => {
    const manifest = createManifest();
    const updated = addArtifact(
      manifest,
      '/engine.wasm',
      'sha256-abc123' as SRIString
    );

    expect(updated.artifacts['/engine.wasm']).toEqual({
      sri: 'sha256-abc123',
    });
  });

  it('should add artifact with signature', () => {
    const manifest = createManifest();
    const updated = addArtifact(
      manifest,
      '/engine.wasm',
      'sha256-abc123' as SRIString,
      '/engine.wasm.sig'
    );

    expect(updated.artifacts['/engine.wasm']).toEqual({
      sri: 'sha256-abc123',
      signature: '/engine.wasm.sig',
    });
  });

  it('should not mutate original manifest', () => {
    const manifest = createManifest();
    const updated = addArtifact(
      manifest,
      '/engine.wasm',
      'sha256-abc123' as SRIString
    );

    expect(manifest.artifacts).toEqual({});
    expect(updated.artifacts['/engine.wasm']).toBeDefined();
  });

  it('should add multiple artifacts', () => {
    let manifest = createManifest();
    manifest = addArtifact(manifest, '/a.wasm', 'sha256-a' as SRIString);
    manifest = addArtifact(manifest, '/b.wasm', 'sha256-b' as SRIString);
    manifest = addArtifact(manifest, '/c.wasm', 'sha256-c' as SRIString);

    expect(Object.keys(manifest.artifacts)).toHaveLength(3);
  });
});
