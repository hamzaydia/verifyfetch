<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="80" alt="VerifyFetch" />
</p>

<h1 align="center">VerifyFetch</h1>

<p align="center">
  <strong>Your user downloads a 4GB AI model. It fails at 3.8GB.<br />VerifyFetch resumes from 3.8GB and verifies every byte.</strong>
</p>

<p align="center">
  <a href="https://github.com/hamzaydia/verifyfetch/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/hamzaydia/verifyfetch/ci.yml?style=flat-square&color=10b981" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/v/verifyfetch?style=flat-square&color=10b981" alt="npm" /></a>
  <a href="https://bundlephobia.com/package/verifyfetch"><img src="https://img.shields.io/bundlephobia/minzip/verifyfetch?style=flat-square&color=10b981" alt="size" /></a>
  <a href="https://github.com/hamzaydia/verifyfetch"><img src="https://img.shields.io/github/stars/hamzaydia/verifyfetch?style=flat-square&color=10b981" alt="stars" /></a>
  <a href="https://github.com/hamzaydia/verifyfetch/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/verifyfetch?style=flat-square&color=10b981" alt="license" /></a>
</p>

<br />

```bash
npm install verifyfetch
```

```typescript
import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('/model.bin', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});
```

**That's it.** If the hash doesn't match, it throws. Your users are protected.

---

## Why?

Loading large files in the browser is broken:

- **Memory explosion** — `crypto.subtle.digest()` buffers the entire file. 4GB model = 4GB RAM = crash.
- **No resume** — Network drops at 3.8GB? Start over from zero.
- **Silent corruption** — CDN serves bad bytes? You won't know until inference gives garbage.
- **Supply chain attacks** — [polyfill.io](https://sansec.io/research/polyfill-supply-chain-attack) compromised 100K+ sites.

VerifyFetch fixes all of these: **streaming verification in constant memory, resumable downloads, fail-fast corruption detection.**

---

## Use with Transformers.js

```bash
npm install @verifyfetch/transformers @huggingface/transformers
```

**1. Generate hashes for your model:**

```bash
npx @verifyfetch/cli hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english
```

**2. Use it:**

```typescript
import { verifiedPipeline } from '@verifyfetch/transformers';

const classifier = await verifiedPipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  { manifestUrl: '/models.vf.manifest.json' }
);

const result = await classifier('I love this!');
// [{ label: 'POSITIVE', score: 0.99 }]
```

Every file is verified and resumable. If the connection drops, it picks up where it left off.

---

## Use with WebLLM

```bash
npm install @verifyfetch/webllm @mlc-ai/web-llm
```

```typescript
import { createVerifiedMLCEngine } from '@verifyfetch/webllm';

const engine = await createVerifiedMLCEngine('Phi-3-mini-4k-instruct-q4f16_1-MLC', {
  manifestUrl: '/models.vf.manifest.json',
  onProgress: ({ file, percent, resumed }) => {
    console.log(`${file}: ${percent}%${resumed ? ' (resumed)' : ''}`);
  }
});
```

---

## Use with any file

```typescript
import { verifyFetchResumable } from 'verifyfetch';

const model = await verifyFetchResumable('/phi-3-mini.gguf', {
  chunked: manifest.artifacts['/phi-3-mini.gguf'].chunked,
  persist: true,
  onProgress: ({ percent, resumed }) => {
    console.log(`${percent}%${resumed ? ' (resumed)' : ''}`);
  }
});
```

Or use a **Service Worker** to verify every fetch without changing any code:

```typescript
// sw.js
import { createVerifyWorker } from 'verifyfetch/worker';

createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx', '*.safetensors'],
});
```

```typescript
// app.js — no changes needed
const model = await fetch('/model.bin');  // automatically verified
```

---

## How it works

1. You generate SHA-256 hashes for your files (CLI does this in one command)
2. Hashes are stored in a manifest JSON file you ship with your app
3. VerifyFetch downloads files in chunks, verifying each one as it arrives
4. If a chunk is corrupt, it stops immediately — no wasting bandwidth
5. If the connection drops, it resumes from the last verified chunk via IndexedDB
6. Memory stays constant (~2MB) regardless of file size

---

## Packages

| Package | Description |
|---------|-------------|
| [`verifyfetch`](https://www.npmjs.com/package/verifyfetch) | Core library — verified fetch, streaming, resumable downloads |
| [`@verifyfetch/transformers`](https://www.npmjs.com/package/@verifyfetch/transformers) | Drop-in Transformers.js integration |
| [`@verifyfetch/webllm`](https://www.npmjs.com/package/@verifyfetch/webllm) | Drop-in WebLLM integration |
| [`@verifyfetch/cli`](https://www.npmjs.com/package/@verifyfetch/cli) | CLI to generate hashes and manifests |
| [`@verifyfetch/manifests`](https://www.npmjs.com/package/@verifyfetch/manifests) | Pre-computed hashes for popular models |

---

<details>
<summary><strong>Full API Reference</strong></summary>

### `verifyFetch(url, options)`

```typescript
const response = await verifyFetch('/file.bin', {
  sri: 'sha256-...',
  onFail: 'block',                // 'block' | 'warn' | { fallbackUrl }
  onProgress: (bytes, total) => {},
});
```

### `verifyFetchStream(url, options)`

Streaming verification with constant memory.

```typescript
const { stream, verified } = await verifyFetchStream('/file.bin', {
  sri: 'sha256-...',
});

for await (const chunk of stream) {
  await processChunk(chunk);
}

await verified;  // throws if verification fails
```

### `verifyFetchResumable(url, options)`

Resumable downloads with chunked verification via IndexedDB.

```typescript
const result = await verifyFetchResumable('/model.bin', {
  chunked: manifest.artifacts['/model.bin'].chunked,
  persist: true,
  onProgress: ({ bytesVerified, totalBytes, resumed, speed, eta }) => {},
});
```

### `verifyFetchFromSources(sri, path, options)`

Multi-CDN failover.

```typescript
const response = await verifyFetchFromSources('sha256-...', '/file.bin', {
  sources: ['https://cdn1.com', 'https://cdn2.com'],
  strategy: 'race',  // 'sequential' | 'race' | 'fastest'
});
```

### `createVerifyWorker(options)` (Service Worker)

```typescript
createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx'],
  onFail: 'block',
});
```

### CLI

```bash
npx verifyfetch sign <files...>                    # Generate SRI hashes
npx verifyfetch sign --chunked <files...>          # With chunk hashes
npx verifyfetch hash-model <model-id>              # Hash a HuggingFace model
npx verifyfetch enforce --manifest vf.manifest.json # Verify in CI
```

</details>

<details>
<summary><strong>Security Model</strong></summary>

**Protects against:** CDN compromise, MITM attacks, accidental corruption, supply chain attacks.

**Does NOT protect against:** Compromised build pipeline (you ship wrong hashes). Use `verifyfetch enforce` in CI for that.

</details>

<details>
<summary><strong>Contributing</strong></summary>

```bash
pnpm install
pnpm build:wasm   # Requires Rust
pnpm build
pnpm test         # 437 tests
```

</details>

---

<p align="center">
  <a href="https://verifyfetch.com">Docs</a> &middot;
  <a href="https://github.com/hamzaydia/verifyfetch">GitHub</a> &middot;
  <a href="https://github.com/hamzaydia/verifyfetch/releases">Changelog</a>
</p>

<p align="center">
  <sub>Apache-2.0 License</sub>
</p>
