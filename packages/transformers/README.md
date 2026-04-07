<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="70" alt="VerifyFetch" />
</p>

<h1 align="center">@verifyfetch/transformers</h1>

<p align="center">
  <strong>Verified, resumable model loading for Transformers.js.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verifyfetch/transformers"><img src="https://img.shields.io/npm/v/@verifyfetch/transformers.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@verifyfetch/transformers"><img src="https://img.shields.io/npm/dm/@verifyfetch/transformers.svg" alt="npm downloads" /></a>
</p>

---

## The Problem

Loading AI models in the browser. Network drops at 80%. Start over.

This package adds:
- **Integrity verification** - Detect corrupted/tampered models before they run
- **Resumable downloads** - Network fails at 80%? Resume from 80%, not 0%
- **Chunked verification** - Detect corruption at first bad chunk, don't download everything

## Install

```bash
npm install @verifyfetch/transformers @huggingface/transformers
```

## Quick Start

### Option 1: verifiedPipeline (recommended)

Drop-in replacement for `pipeline()` with verification built in.

```typescript
import { verifiedPipeline } from '@verifyfetch/transformers';

const classifier = await verifiedPipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  {
    manifestUrl: '/models/vf-hf.manifest.json',
    onProgress: (p) => console.log(`${p.file}: ${p.percent}%`)
  }
);

const result = await classifier('I love this!');
console.log(result); // [{ label: 'POSITIVE', score: 0.99 }]
```

### Option 2: enableVerification (global interceptor)

Verify all Transformers.js downloads automatically by intercepting `env.fetch`.

```typescript
import { enableVerification } from '@verifyfetch/transformers';
import { pipeline } from '@huggingface/transformers';

await enableVerification({
  manifestUrl: '/models/vf-hf.manifest.json'
});

// Now ALL pipeline() calls are verified automatically
const classifier = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
);
```

### Option 3: Preloader (explicit control)

```typescript
import { preloadVerifiedModel } from '@verifyfetch/transformers';
import { pipeline } from '@huggingface/transformers';

// Pre-download with verification
await preloadVerifiedModel(
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  {
    manifestUrl: '/models/vf-hf.manifest.json',
    onProgress: ({ file, percent, resumed }) => {
      console.log(`${file}: ${percent}%${resumed ? ' (resumed)' : ''}`);
    }
  }
);

// Now use standard Transformers.js - model is cached
const classifier = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
);
```

## Model Manifest Format

Create a manifest with hashes for your model files:

```json
{
  "version": 2,
  "models": {
    "Xenova/distilbert-base-uncased-finetuned-sst-2-english": {
      "baseUrl": "https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/",
      "files": {
        "tokenizer.json": {
          "sri": "sha256-abc123..."
        },
        "onnx/model_quantized.onnx": {
          "sri": "sha256-full...",
          "size": 67000000,
          "chunked": {
            "root": "sha256-root...",
            "chunkSize": 1048576,
            "hashes": ["sha256-c0...", "sha256-c1...", "..."]
          }
        }
      }
    }
  }
}
```

Generate it with the CLI:

```bash
npx @verifyfetch/cli hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english
```

## API

### verifiedPipeline

Creates a Transformers.js pipeline with verified model downloads.

```typescript
const pipe = await verifiedPipeline(task, model, {
  manifestUrl?: string,     // URL to fetch manifest
  manifest?: Manifest,      // Or inline manifest
  onFail?: 'block' | 'warn', // Default: 'block'
  resumable?: boolean,      // Default: true
  onProgress?: (progress) => void,
  dtype?: string,           // e.g., 'fp32', 'fp16', 'q8', 'q4'
  revision?: string,        // Specific HF revision
});
```

### enableVerification / disableVerification

Global interceptor for all Transformers.js downloads.

```typescript
await enableVerification({
  manifestUrl?: string,
  manifest?: Manifest,
  onFail?: 'block' | 'warn',
  resumable?: boolean,
  cacheName?: string,
});

isVerificationEnabled(); // true

await disableVerification();
```

### preloadVerifiedModel

Pre-download and verify model files before Transformers.js loads them.

```typescript
const result = await preloadVerifiedModel(modelId, {
  manifestUrl?: string,
  manifest?: Manifest,
  onProgress?: (progress) => void,
  onFail?: 'block' | 'warn',
  resumable?: boolean,
});

// result: { modelId, resumed, filesResumed, totalFiles, totalBytes, duration }
```

### Utilities

```typescript
// Check if model is already cached
const cached = await isModelCached(modelId, { manifest });

// Clear cached model
await clearModelCache(modelId, { manifest });

// Get download progress for partial download
const progress = await getPreloadProgress(modelId, { manifest });
```

## How It Works

1. **Pre-download with verification** - Files are downloaded and verified against SRI hashes
2. **Cache in Transformers.js cache** - Verified files are stored where Transformers.js expects them
3. **Transformers.js finds cached files** - When loading, it finds files already in cache
4. **No re-download needed** - Transformers.js uses the pre-verified cached files

## Testing

```bash
# Run all tests (69 tests)
pnpm test
```

**Test coverage includes:**
- Model manifest validation and querying (37 tests)
- Preloader with cache operations (17 tests)
- Hub interceptor for global verification (9 tests)
- Verified pipeline wrapper (6 tests)

## Related

- [verifyfetch](https://www.npmjs.com/package/verifyfetch) - Core library
- [@verifyfetch/cli](https://www.npmjs.com/package/@verifyfetch/cli) - Generate manifests
- [@verifyfetch/webllm](https://www.npmjs.com/package/@verifyfetch/webllm) - WebLLM integration
- [GitHub](https://github.com/hamzaydia/verifyfetch)

## License

Apache-2.0
