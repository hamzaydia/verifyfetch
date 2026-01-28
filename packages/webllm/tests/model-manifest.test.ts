/**
 * Tests for model-manifest.ts
 *
 * Real tests with real data - no mocks where avoidable.
 */

import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  getModelEntry,
  getModelFiles,
  getFileUrl,
  isChunkedFile,
  getAvailableModels,
  createEmptyManifest,
  addModelToManifest,
} from '../src/model-manifest.js';
import { ManifestError, ModelNotFoundError } from '../src/types.js';
import type { ModelVerificationManifest, ModelEntry } from '../src/types.js';

// Real manifest with computed hashes
const validManifest: ModelVerificationManifest = {
  version: 2,
  models: {
    'test-model-small': {
      baseUrl: 'https://example.com/models/test-small/',
      files: {
        'config.json': {
          sri: 'sha256-n4bQgYhMfWWaL28MTgkFjqq2MQ55+W/pJGmngHmfp+A=',
        },
        'tokenizer.json': {
          sri: 'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=',
        },
      },
    },
    'test-model-chunked': {
      baseUrl: 'https://example.com/models/test-chunked/',
      files: {
        'config.json': {
          sri: 'sha256-n4bQgYhMfWWaL28MTgkFjqq2MQ55+W/pJGmngHmfp+A=',
        },
        'params_shard_0.bin': {
          sri: 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
          size: 3145728,
          chunked: {
            root: 'sha256-abc123',
            chunkSize: 1048576,
            hashes: [
              'sha256-chunk0hash00000000000000000000000000000000=',
              'sha256-chunk1hash00000000000000000000000000000000=',
              'sha256-chunk2hash00000000000000000000000000000000=',
            ],
          },
        },
      },
    },
  },
};

describe('validateManifest', () => {
  it('validates a correct manifest', () => {
    const result = validateManifest(validManifest);
    expect(result).toEqual(validManifest);
  });

  it('validates version 1 manifests', () => {
    const v1Manifest = {
      version: 1,
      models: {
        'simple-model': {
          baseUrl: 'https://example.com/models/',
          files: {
            'file.bin': {
              sri: 'sha256-test123',
            },
          },
        },
      },
    };
    const result = validateManifest(v1Manifest);
    expect(result.version).toBe(1);
  });

  it('rejects non-object input', () => {
    expect(() => validateManifest(null)).toThrow(ManifestError);
    expect(() => validateManifest('string')).toThrow(ManifestError);
    expect(() => validateManifest(123)).toThrow(ManifestError);
    expect(() => validateManifest(undefined)).toThrow(ManifestError);
  });

  it('rejects invalid version', () => {
    expect(() => validateManifest({ version: 3, models: {} })).toThrow(
      'version must be 1 or 2'
    );
    expect(() => validateManifest({ version: 'one', models: {} })).toThrow(
      'version must be 1 or 2'
    );
  });

  it('rejects missing models', () => {
    expect(() => validateManifest({ version: 2 })).toThrow('"models" object');
    expect(() => validateManifest({ version: 2, models: 'wrong' })).toThrow(
      '"models" object'
    );
  });

  it('rejects model without baseUrl', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          bad: { files: {} },
        },
      })
    ).toThrow('"baseUrl" string');
  });

  it('rejects model without files', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          bad: { baseUrl: 'https://test.com/' },
        },
      })
    ).toThrow('"files" object');
  });

  it('rejects file without sri', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          bad: {
            baseUrl: 'https://test.com/',
            files: {
              'file.bin': {},
            },
          },
        },
      })
    ).toThrow('"sri" string');
  });

  it('rejects invalid sri format', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          bad: {
            baseUrl: 'https://test.com/',
            files: {
              'file.bin': { sri: 'md5-invalid' },
            },
          },
        },
      })
    ).toThrow('invalid SRI format');
  });

  it('accepts valid sri formats', () => {
    const validSriFormats = [
      'sha256-abc123',
      'sha384-abc123def456',
      'sha512-abc123def456ghi789',
      'sha256-n4bQgYhMfWWaL28MTgkFjqq2MQ55+W/pJGmngHmfp+A=',
    ];

    for (const sri of validSriFormats) {
      const manifest = {
        version: 2,
        models: {
          test: {
            baseUrl: 'https://test.com/',
            files: {
              'file.bin': { sri },
            },
          },
        },
      };
      expect(() => validateManifest(manifest)).not.toThrow();
    }
  });

  it('validates chunked config', () => {
    const manifestWithChunked = {
      version: 2,
      models: {
        test: {
          baseUrl: 'https://test.com/',
          files: {
            'shard.bin': {
              sri: 'sha256-full123',
              size: 1024,
              chunked: {
                root: 'sha256-root123',
                chunkSize: 512,
                hashes: ['sha256-chunk0', 'sha256-chunk1'],
              },
            },
          },
        },
      },
    };
    expect(() => validateManifest(manifestWithChunked)).not.toThrow();
  });

  it('rejects invalid chunked config - missing root', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          test: {
            baseUrl: 'https://test.com/',
            files: {
              'shard.bin': {
                sri: 'sha256-full123',
                chunked: {
                  chunkSize: 512,
                  hashes: ['sha256-chunk0'],
                },
              },
            },
          },
        },
      })
    ).toThrow('valid "root" SRI');
  });

  it('rejects invalid chunked config - bad chunkSize', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          test: {
            baseUrl: 'https://test.com/',
            files: {
              'shard.bin': {
                sri: 'sha256-full123',
                chunked: {
                  root: 'sha256-root123',
                  chunkSize: 0,
                  hashes: ['sha256-chunk0'],
                },
              },
            },
          },
        },
      })
    ).toThrow('positive "chunkSize"');
  });

  it('rejects invalid chunked config - empty hashes', () => {
    expect(() =>
      validateManifest({
        version: 2,
        models: {
          test: {
            baseUrl: 'https://test.com/',
            files: {
              'shard.bin': {
                sri: 'sha256-full123',
                chunked: {
                  root: 'sha256-root123',
                  chunkSize: 512,
                  hashes: [],
                },
              },
            },
          },
        },
      })
    ).toThrow('non-empty "hashes" array');
  });
});

describe('getModelEntry', () => {
  it('returns model entry for valid model ID', () => {
    const entry = getModelEntry('test-model-small', validManifest);
    expect(entry.baseUrl).toBe('https://example.com/models/test-small/');
    expect(Object.keys(entry.files)).toHaveLength(2);
  });

  it('throws ModelNotFoundError for unknown model', () => {
    expect(() => getModelEntry('nonexistent', validManifest)).toThrow(
      ModelNotFoundError
    );
  });

  it('includes available models in error message', () => {
    try {
      getModelEntry('nonexistent', validManifest);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ModelNotFoundError);
      expect((e as Error).message).toContain('test-model-small');
      expect((e as Error).message).toContain('test-model-chunked');
    }
  });
});

describe('getModelFiles', () => {
  it('returns all files for a model', () => {
    const files = getModelFiles('test-model-small', validManifest);
    expect(files).toHaveLength(2);

    const filenames = files.map(([name]) => name);
    expect(filenames).toContain('config.json');
    expect(filenames).toContain('tokenizer.json');
  });

  it('includes file info with sri', () => {
    const files = getModelFiles('test-model-small', validManifest);
    const configFile = files.find(([name]) => name === 'config.json');
    expect(configFile).toBeDefined();
    expect(configFile![1].sri).toBe(
      'sha256-n4bQgYhMfWWaL28MTgkFjqq2MQ55+W/pJGmngHmfp+A='
    );
  });

  it('includes chunked info for large files', () => {
    const files = getModelFiles('test-model-chunked', validManifest);
    const shardFile = files.find(([name]) => name === 'params_shard_0.bin');
    expect(shardFile).toBeDefined();
    expect(shardFile![1].chunked).toBeDefined();
    expect(shardFile![1].chunked?.hashes).toHaveLength(3);
  });
});

describe('getFileUrl', () => {
  it('constructs correct URL with trailing slash in baseUrl', () => {
    const url = getFileUrl('test-model-small', 'config.json', validManifest);
    expect(url).toBe('https://example.com/models/test-small/config.json');
  });

  it('handles baseUrl without trailing slash', () => {
    const manifestNoSlash: ModelVerificationManifest = {
      version: 2,
      models: {
        test: {
          baseUrl: 'https://example.com/models',
          files: {
            'file.bin': { sri: 'sha256-test123' },
          },
        },
      },
    };
    const url = getFileUrl('test', 'file.bin', manifestNoSlash);
    expect(url).toBe('https://example.com/models/file.bin');
  });
});

describe('isChunkedFile', () => {
  it('returns true for files with chunked config', () => {
    const files = getModelFiles('test-model-chunked', validManifest);
    const shardFile = files.find(([name]) => name === 'params_shard_0.bin');
    expect(isChunkedFile(shardFile![1])).toBe(true);
  });

  it('returns false for files without chunked config', () => {
    const files = getModelFiles('test-model-small', validManifest);
    const configFile = files.find(([name]) => name === 'config.json');
    expect(isChunkedFile(configFile![1])).toBe(false);
  });

  it('returns false for empty chunked hashes', () => {
    expect(
      isChunkedFile({
        sri: 'sha256-test123',
        chunked: {
          root: 'sha256-root123',
          chunkSize: 512,
          hashes: [],
        },
      })
    ).toBe(false);
  });
});

describe('getAvailableModels', () => {
  it('returns all model IDs', () => {
    const models = getAvailableModels(validManifest);
    expect(models).toHaveLength(2);
    expect(models).toContain('test-model-small');
    expect(models).toContain('test-model-chunked');
  });

  it('returns empty array for empty manifest', () => {
    const emptyManifest: ModelVerificationManifest = {
      version: 2,
      models: {},
    };
    const models = getAvailableModels(emptyManifest);
    expect(models).toHaveLength(0);
  });
});

describe('createEmptyManifest', () => {
  it('creates a valid empty manifest', () => {
    const manifest = createEmptyManifest();
    expect(manifest.version).toBe(2);
    expect(manifest.models).toEqual({});
    expect(() => validateManifest(manifest)).not.toThrow();
  });
});

describe('addModelToManifest', () => {
  it('adds a model without mutating original', () => {
    const original = createEmptyManifest();
    const entry: ModelEntry = {
      baseUrl: 'https://test.com/',
      files: {
        'file.bin': { sri: 'sha256-test123' },
      },
    };

    const updated = addModelToManifest(original, 'new-model', entry);

    // Original unchanged
    expect(Object.keys(original.models)).toHaveLength(0);

    // Updated has new model
    expect(Object.keys(updated.models)).toHaveLength(1);
    expect(updated.models['new-model']).toEqual(entry);
  });

  it('can add multiple models', () => {
    let manifest = createEmptyManifest();

    manifest = addModelToManifest(manifest, 'model-1', {
      baseUrl: 'https://test.com/1/',
      files: { 'a.bin': { sri: 'sha256-a123' } },
    });

    manifest = addModelToManifest(manifest, 'model-2', {
      baseUrl: 'https://test.com/2/',
      files: { 'b.bin': { sri: 'sha256-b123' } },
    });

    expect(Object.keys(manifest.models)).toHaveLength(2);
    expect(manifest.models['model-1']).toBeDefined();
    expect(manifest.models['model-2']).toBeDefined();
  });
});
