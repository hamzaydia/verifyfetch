<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="70" alt="VerifyFetch" />
</p>

<h1 align="center">@verifyfetch/manifests</h1>

<p align="center">
  <strong>Pre-computed integrity manifests for popular AI models.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verifyfetch/manifests"><img src="https://img.shields.io/npm/v/@verifyfetch/manifests.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@verifyfetch/manifests"><img src="https://img.shields.io/npm/dm/@verifyfetch/manifests.svg" alt="npm downloads" /></a>
</p>

---

Ready-to-use verification hashes for Transformers.js and WebLLM models. Skip the hash generation step and start verifying immediately.

## Install

```bash
npm install @verifyfetch/manifests
```

## Quick Start

Import a manifest directly and pass it to any verifyfetch integration:

```typescript
import { verifiedPipeline } from '@verifyfetch/transformers';
import manifest from '@verifyfetch/manifests/transformers/Xenova--distilbert-base-uncased-finetuned-sst-2-english.json';

const classifier = await verifiedPipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  { manifest }
);
```

## Available Models

### Transformers.js

| Model | Import |
|-------|--------|
| `Xenova/distilbert-base-uncased-finetuned-sst-2-english` | `@verifyfetch/manifests/transformers/Xenova--distilbert-base-uncased-finetuned-sst-2-english.json` |
| `Xenova/all-MiniLM-L6-v2` | `@verifyfetch/manifests/transformers/Xenova--all-MiniLM-L6-v2.json` |

### WebLLM

| Model | Import |
|-------|--------|
| `Phi-3-mini-4k-instruct-q4f16_1-MLC` | `@verifyfetch/manifests/webllm/Phi-3-mini-4k-instruct-q4f16_1-MLC.json` |

## API

```typescript
import { availableModels, getManifestPath } from '@verifyfetch/manifests';

// List available models
console.log(availableModels.transformers);
// ['Xenova/distilbert-base-uncased-finetuned-sst-2-english', 'Xenova/all-MiniLM-L6-v2']

console.log(availableModels.webllm);
// ['Phi-3-mini-4k-instruct-q4f16_1-MLC']

// Get import path for a model
const path = getManifestPath('transformers', 'Xenova/all-MiniLM-L6-v2');
// '@verifyfetch/manifests/transformers/Xenova--all-MiniLM-L6-v2.json'
```

## Generate Your Own

To generate manifests for models not included here:

```bash
npx @verifyfetch/cli hash-model <model-id>
```

## Related

- [verifyfetch](https://www.npmjs.com/package/verifyfetch) - Core library
- [@verifyfetch/transformers](https://www.npmjs.com/package/@verifyfetch/transformers) - Transformers.js integration
- [@verifyfetch/webllm](https://www.npmjs.com/package/@verifyfetch/webllm) - WebLLM integration
- [GitHub](https://github.com/hamzaydia/verifyfetch)

## License

Apache-2.0
