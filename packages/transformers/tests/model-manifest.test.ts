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
  lookupSriByUrl,
} from '../src/model-manifest.js';
import { ManifestError, ModelNotFoundError } from '../src/types.js';
import type { ModelVerificationManifest, ModelEntry } from '../src/types.js';

// Real manifest with computed hashes (HuggingFace-style models)
const validManifest: ModelVerificationManifest = {
  version: 2,
  models: {
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english': {
      baseUrl: 'https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/',
      files: {
        'onnx/model_quantized.onnx': {
          sri: 'sha256-n4bQgYhMfWWaL28MTgkFjqq2MQ55+W/pJGmngHmfp+A=',
          size: 67000000,
        },
        'tokenizer.json': {
          sri: 'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=',
        },
        'config.json': {
          sri: 'sha256-abc123def456ghi789jkl012mno345pqr678stu901v=',
        },
      },
    },
    'Xenova/all-MiniLM-L6-v2': {
      baseUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/',
      files: {
        'onnx/model_quantized.onnx': {
          sri: 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
          size: 22500000,
        },
        'tokenizer.json': {
          sri: 'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=',
        },
      },
    },
    'large-model-chunked': {
      baseUrl: 'https://huggingface.co/test/large-model/resolve/main/',
      files: {
        'model.onnx': {
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
    const entry = getModelEntry('Xenova/distilbert-base-uncased-finetuned-sst-2-english', validManifest);
    expect(entry.baseUrl).toBe('https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/');
    expect(Object.keys(entry.files)).toHaveLength(3);
  });

  it('throws ModelNotFoundError for unknown model', () => {
    expect(() => getModelEntry('nonexistent/model', validManifest)).toThrow(
      ModelNotFoundError
    );
  });

  it('includes available models in error message', () => {
    try {
      getModelEntry('nonexistent', validManifest);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ModelNotFoundError);
      expect((e as Error).message).toContain('Xenova/distilbert-base-uncased-finetuned-sst-2-english');
      expect((e as Error).message).toContain('Xenova/all-MiniLM-L6-v2');
    }
  });
});

describe('getModelFiles', () => {
  it('returns all files for a model', () => {
    const files = getModelFiles('Xenova/distilbert-base-uncased-finetuned-sst-2-english', validManifest);
    expect(files).toHaveLength(3);

    const filenames = files.map(([name]) => name);
    expect(filenames).toContain('onnx/model_quantized.onnx');
    expect(filenames).toContain('tokenizer.json');
    expect(filenames).toContain('config.json');
  });

  it('includes file info with sri and size', () => {
    const files = getModelFiles('Xenova/distilbert-base-uncased-finetuned-sst-2-english', validManifest);
    const modelFile = files.find(([name]) => name === 'onnx/model_quantized.onnx');
    expect(modelFile).toBeDefined();
    expect(modelFile![1].sri).toBe('sha256-n4bQgYhMfWWaL28MTgkFjqq2MQ55+W/pJGmngHmfp+A=');
    expect(modelFile![1].size).toBe(67000000);
  });

  it('includes chunked info for large files', () => {
    const files = getModelFiles('large-model-chunked', validManifest);
    const modelFile = files.find(([name]) => name === 'model.onnx');
    expect(modelFile).toBeDefined();
    expect(modelFile![1].chunked).toBeDefined();
    expect(modelFile![1].chunked?.hashes).toHaveLength(3);
  });
});

describe('getFileUrl', () => {
  it('constructs correct URL with trailing slash in baseUrl', () => {
    const url = getFileUrl('Xenova/distilbert-base-uncased-finetuned-sst-2-english', 'tokenizer.json', validManifest);
    expect(url).toBe('https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/tokenizer.json');
  });

  it('handles nested paths correctly', () => {
    const url = getFileUrl('Xenova/distilbert-base-uncased-finetuned-sst-2-english', 'onnx/model_quantized.onnx', validManifest);
    expect(url).toBe('https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/onnx/model_quantized.onnx');
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
    const files = getModelFiles('large-model-chunked', validManifest);
    const modelFile = files.find(([name]) => name === 'model.onnx');
    expect(isChunkedFile(modelFile![1])).toBe(true);
  });

  it('returns false for files without chunked config', () => {
    const files = getModelFiles('Xenova/distilbert-base-uncased-finetuned-sst-2-english', validManifest);
    const tokenizer = files.find(([name]) => name === 'tokenizer.json');
    expect(isChunkedFile(tokenizer![1])).toBe(false);
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
    expect(models).toHaveLength(3);
    expect(models).toContain('Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    expect(models).toContain('Xenova/all-MiniLM-L6-v2');
    expect(models).toContain('large-model-chunked');
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
      baseUrl: 'https://huggingface.co/test/model/resolve/main/',
      files: {
        'model.onnx': { sri: 'sha256-test123' },
      },
    };

    const updated = addModelToManifest(original, 'test/model', entry);

    // Original unchanged
    expect(Object.keys(original.models)).toHaveLength(0);

    // Updated has new model
    expect(Object.keys(updated.models)).toHaveLength(1);
    expect(updated.models['test/model']).toEqual(entry);
  });

  it('can add multiple models', () => {
    let manifest = createEmptyManifest();

    manifest = addModelToManifest(manifest, 'Xenova/model-1', {
      baseUrl: 'https://huggingface.co/Xenova/model-1/resolve/main/',
      files: { 'a.onnx': { sri: 'sha256-a123' } },
    });

    manifest = addModelToManifest(manifest, 'Xenova/model-2', {
      baseUrl: 'https://huggingface.co/Xenova/model-2/resolve/main/',
      files: { 'b.onnx': { sri: 'sha256-b123' } },
    });

    expect(Object.keys(manifest.models)).toHaveLength(2);
    expect(manifest.models['Xenova/model-1']).toBeDefined();
    expect(manifest.models['Xenova/model-2']).toBeDefined();
  });
});

describe('lookupSriByUrl', () => {
  it('finds file by direct URL match', () => {
    const result = lookupSriByUrl(
      'https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/tokenizer.json',
      validManifest
    );

    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    expect(result!.filename).toBe('tokenizer.json');
    expect(result!.fileInfo.sri).toBe('sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=');
  });

  it('finds file by HuggingFace URL pattern', () => {
    const result = lookupSriByUrl(
      'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
      validManifest
    );

    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('Xenova/all-MiniLM-L6-v2');
    expect(result!.filename).toBe('tokenizer.json');
  });

  it('finds nested path files', () => {
    const result = lookupSriByUrl(
      'https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/onnx/model_quantized.onnx',
      validManifest
    );

    expect(result).not.toBeNull();
    expect(result!.filename).toBe('onnx/model_quantized.onnx');
  });

  it('returns null for unknown URLs', () => {
    const result = lookupSriByUrl(
      'https://huggingface.co/unknown/model/resolve/main/file.onnx',
      validManifest
    );

    expect(result).toBeNull();
  });

  it('returns null for non-HuggingFace URLs', () => {
    const result = lookupSriByUrl(
      'https://cdn.example.com/some/file.bin',
      validManifest
    );

    expect(result).toBeNull();
  });

  it('handles URLs with query parameters', () => {
    const result = lookupSriByUrl(
      'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json?download=true',
      validManifest
    );

    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('Xenova/all-MiniLM-L6-v2');
  });
});
