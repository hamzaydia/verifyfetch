<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="70" alt="VerifyFetch" />
</p>

<h1 align="center">@verifyfetch/webllm</h1>

<p align="center">
  <strong>Verified, resumable model loading for WebLLM.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verifyfetch/webllm"><img src="https://img.shields.io/npm/v/@verifyfetch/webllm.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@verifyfetch/webllm"><img src="https://img.shields.io/npm/dm/@verifyfetch/webllm.svg" alt="npm downloads" /></a>
</p>

---

## The Problem

Loading a 4GB AI model in the browser. Network drops at 3.8GB. Start over.

This package adds:
- **Integrity verification** - Detect corrupted/tampered models before they run
- **Resumable downloads** - Network fails at 80%? Resume from 80%, not 0%
- **Chunked verification** - Detect corruption at first bad chunk, don't download everything

## Install

```bash
npm install @verifyfetch/webllm @mlc-ai/web-llm
```

## Quick Start

### Option 1: VerifiedMLCEngine (drop-in replacement)

```typescript
import { VerifiedMLCEngine } from '@verifyfetch/webllm';

const engine = new VerifiedMLCEngine({
  verification: {
    manifestUrl: '/models/vf.manifest.json'
  },
  initProgressCallback: (report) => {
    // Shows: "Verifying Phi-3: 45% (resumed)" then "Loading Phi-3: 80%"
    console.log(report.text);
  }
});

// Load model - verification happens automatically
await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');

// Use normally
const response = await engine.chat.completions.create({
  messages: [{ role: 'user', content: 'What is 2+2?' }]
});
```

### Option 2: Preloader (explicit control)

```typescript
import { preloadVerifiedModel } from '@verifyfetch/webllm';
import { MLCEngine } from '@mlc-ai/web-llm';

// Pre-download with verification
await preloadVerifiedModel('Phi-3-mini-4k-instruct-q4f16_1-MLC', {
  manifestUrl: '/models/vf.manifest.json',
  onProgress: ({ file, percent, resumed }) => {
    console.log(`${file}: ${percent}%${resumed ? ' (resumed)' : ''}`);
  }
});

// Now use standard WebLLM - model is cached
const engine = new MLCEngine();
await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');
```

## Model Manifest Format

Create a manifest with hashes for your model files:

```json
{
  "version": 2,
  "models": {
    "Phi-3-mini-4k-instruct-q4f16_1-MLC": {
      "baseUrl": "https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC/resolve/main/",
      "files": {
        "mlc-chat-config.json": {
          "sri": "sha256-abc123..."
        },
        "params_shard_0.bin": {
          "sri": "sha256-full...",
          "size": 536870912,
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
npx @verifyfetch/cli sign --chunked ./model-directory/
```

## API

### VerifiedMLCEngine

Drop-in replacement for WebLLM's `MLCEngine` with verification.

```typescript
new VerifiedMLCEngine({
  verification: {
    manifestUrl?: string,     // URL to fetch manifest
    manifest?: Manifest,      // Or inline manifest
    onFail?: 'block' | 'warn', // Default: 'block'
    resumable?: boolean,      // Default: true
  },
  initProgressCallback?: (report) => void,
})
```

### preloadVerifiedModel

Pre-download and verify a model before WebLLM loads it.

```typescript
const result = await preloadVerifiedModel(modelId, {
  manifestUrl?: string,
  manifest?: Manifest,
  onProgress?: (progress) => void,
  onFail?: 'block' | 'warn',
  resumable?: boolean,
});
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
2. **Cache in web-llm's cache** - Verified files are stored in `webllm/model`, `webllm/config`, `webllm/wasm` caches
3. **WebLLM finds cached files** - When WebLLM loads the model, it finds files already in cache
4. **No re-download needed** - WebLLM uses the pre-verified cached files

This means verification happens before WebLLM touches the data, and WebLLM benefits from cached files without modification.

## Why This Exists

WebLLM issue [#761](https://github.com/mlc-ai/web-llm/issues/761) requests integrity verification for model loading. This package provides that today, without waiting for upstream changes.

## Testing

The package includes comprehensive tests covering unit tests, real network integration, and browser-based WebGPU testing.

### Unit & Integration Tests

```bash
# Run all tests (85 tests)
pnpm test

# Run with verbose output
pnpm test -- --run
```

**Test coverage includes:**
- Manifest validation and model entry handling (30 tests)
- Preloader with cache operations (13 tests)
- VerifiedMLCEngine wrapper (12 tests)
- Real HuggingFace integration - downloads actual model files (18 tests)
- Real WebLLM model files - verifies tokenizer, config, ndarray-cache (12 tests)

### Browser Test (WebGPU)

For full end-to-end testing with actual WebLLM inference:

```bash
# Start the test server
pnpm test:browser

# Open in Chrome/Edge (WebGPU required)
# http://localhost:3000/browser-test.html
```

The browser test:
1. Verifies WebGPU availability
2. Downloads real model files from HuggingFace
3. Computes and verifies SHA-256 hashes in-browser
4. Tests Cache API storage
5. (Optional) Loads full 2GB model and runs inference

## Related

- [verifyfetch](https://www.npmjs.com/package/verifyfetch) - Core library
- [@verifyfetch/cli](https://www.npmjs.com/package/@verifyfetch/cli) - Generate manifests
- [GitHub](https://github.com/hamzaydia/verifyfetch)

## License

Apache-2.0
