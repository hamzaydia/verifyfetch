<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="80" alt="VerifyFetch" />
</p>

<h1 align="center">VerifyFetch</h1>

<p align="center">
  <strong>Download large files. Verify them. Resume when it fails.</strong>
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

## Why VerifyFetch?

### The Problem

Loading large files in the browser is painful:

1. **Memory explosion** - `crypto.subtle.digest()` buffers the entire file. 4GB AI model = 4GB+ RAM = browser crash.
2. **No fail-fast** - Download 4GB, find corruption at the end, start over.
3. **CDN compromises** - [polyfill.io](https://sansec.io/research/polyfill-supply-chain-attack) affected 100K+ sites.

### The Solution

| Feature | Native `fetch` | VerifyFetch |
|---------|---------------|-------------|
| Basic SRI verification | Yes | Yes |
| **Constant memory** | No (buffers all) | Yes (streaming WASM) |
| **Fail-fast on corruption** | No | Yes (chunked verification) |
| **Progress callbacks** | No | Yes |
| **Multi-CDN failover** | No | Yes |
| **Service Worker mode** | No | Yes |

---

## Quick Start

### Option 1: Direct Usage

```typescript
import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('/engine.wasm', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});
```

### Option 2: Service Worker Mode (Zero-Code)

Add verification to **every fetch** without changing your app code:

```typescript
// sw.js (your Service Worker)
import { createVerifyWorker } from 'verifyfetch/worker';

createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx', '*.safetensors'],
  onFail: 'block'
});
```

```typescript
// app.js - No changes needed!
const model = await fetch('/model.bin');  // Automatically verified!
```

### Option 3: Manifest Mode

```typescript
import { createVerifyFetcher } from 'verifyfetch';

const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

const wasm = await vf.arrayBuffer('/engine.wasm');  // Hash looked up automatically
```

---

## For AI Models (WebLLM, Transformers.js, ONNX)

Loading multi-GB models in the browser? This is what VerifyFetch was built for.

**The pain:**
- Download 4GB model, network drops at 3.8GB, start over
- Native `crypto.subtle` needs 4GB RAM just to verify a 4GB file
- No way to detect corruption until after downloading everything

**The fix:**

```typescript
import { verifyFetchResumable } from 'verifyfetch';

const model = await verifyFetchResumable('/phi-3-mini.gguf', {
  chunked: manifest.artifacts['/phi-3-mini.gguf'].chunked,
  persist: true,  // Survives page reload
  onProgress: ({ percent, resumed }) => {
    console.log(`${percent}%${resumed ? ' (resumed)' : ''}`);
  }
});
```

- **Memory**: 2MB constant, not 4GB
- **Resume**: Network fails at 80%? Resume from 80%
- **Fail-fast**: Detect corruption immediately, not after downloading everything

> WebLLM is considering native integrity support ([#761](https://github.com/mlc-ai/web-llm/issues/761)). VerifyFetch works today.

---

## Generate Hashes

```bash
# Generate SHA-256 hashes
npx verifyfetch sign ./public/*.wasm ./models/*.bin

# With chunked verification (for large files - enables fail-fast)
npx verifyfetch sign --chunked --chunk-size 1048576 ./large-model.bin

# Output: vf.manifest.json
```

---

## Features

### Streaming Verification

For large files, process chunks as they download with constant memory:

```typescript
import { verifyFetchStream } from 'verifyfetch';

const { stream, verified } = await verifyFetchStream('/model.bin', {
  sri: 'sha256-...'
});

// Process chunks immediately - constant memory usage
for await (const chunk of stream) {
  await uploadToGPU(chunk);
}

// Verification completes after stream ends
await verified;  // Throws IntegrityError if hash doesn't match
```

### Resumable Downloads (NEW in v1.0)

**The killer feature:** Download fails at 3.8GB of 4GB? Resume from 3.8GB, not zero.

```typescript
import { verifyFetchResumable } from 'verifyfetch';

// First attempt - fails at 80%
const result = await verifyFetchResumable('/model.safetensors', {
  chunked: manifest.artifacts['/model.safetensors'].chunked,
  onProgress: ({ chunksVerified, totalChunks, resumed }) => {
    console.log(`${chunksVerified}/${totalChunks} chunks${resumed ? ' (resumed)' : ''}`);
  }
});

// Page reload or network failure...

// Second attempt - automatically resumes from last verified chunk
const result2 = await verifyFetchResumable('/model.safetensors', {
  chunked: manifest.artifacts['/model.safetensors'].chunked,
  onResume: (state) => {
    console.log(`Resuming from chunk ${state.verifiedChunks}/${totalChunks}`);
  }
});
```

**How it works:**
1. Each chunk is verified and stored in IndexedDB as it downloads
2. On failure/reload, loads existing verified chunks from storage
3. Uses HTTP Range requests to fetch only remaining chunks
4. Clean up storage automatically on completion

### Chunked Verification (Fail-Fast)

Stop downloading immediately if corruption is detected:

```typescript
import { createChunkedVerifier, verifyFetchStream } from 'verifyfetch';

// Generate manifest with chunked hashes
// npx verifyfetch sign --chunked ./large-model.bin

// Verify chunk-by-chunk as data arrives
const verifier = createChunkedVerifier(manifest.artifacts['/model.bin'].chunked);

const { stream } = await verifyFetchStream('/model.bin', { sri: chunked.root });

for await (const chunk of stream) {
  const result = await verifier.verifyNextChunk(chunk);

  if (!result.valid) {
    // Don't download 4GB if byte 0 is wrong!
    throw new Error(`Chunk ${result.index} corrupt - stopping immediately`);
  }

  await processChunk(chunk);
}
```

**How it works:** Each chunk is hashed independently. If chunk 5 of 4000 is corrupt, you find out immediately - not after downloading the other 3995 chunks.

### Multi-CDN Failover

Automatically try backup sources if one fails:

```typescript
import { verifyFetchFromSources } from 'verifyfetch';

const response = await verifyFetchFromSources(
  'sha256-abc123...',
  '/model.bin',
  {
    sources: [
      'https://cdn1.example.com',
      'https://cdn2.example.com',
      'https://backup.example.com'
    ],
    strategy: 'race'  // 'sequential' | 'race' | 'fastest'
  }
);
```

### Progress Tracking

```typescript
await verifyFetch('/large-model.bin', {
  sri: 'sha256-...',
  onProgress: (bytes, total) => {
    const percent = total ? Math.round(bytes / total * 100) : 0;
    console.log(`Downloading: ${percent}%`);
  }
});
```

### Fallback URLs

```typescript
await verifyFetch('/main.wasm', {
  sri: 'sha256-...',
  onFail: { fallbackUrl: '/backup.wasm' }
});
```

---

## CLI Commands

```bash
# Generate SRI hashes
npx verifyfetch sign <files...>

# Generate with chunked hashes (for large files)
npx verifyfetch sign --chunked --chunk-size 1048576 <files...>

# Verify files match manifest (for CI)
npx verifyfetch enforce --manifest ./vf.manifest.json

# Add to Next.js project
npx verifyfetch init --next
```

---

## API Reference

### `verifyFetch(url, options)`

Basic verified fetch.

```typescript
const response = await verifyFetch('/file.bin', {
  sri: 'sha256-...',              // Required: SRI hash
  onFail: 'block',                // 'block' | 'warn' | { fallbackUrl }
  onProgress: (bytes, total) => {},
  fetchImpl: fetch                // Custom fetch implementation
});
```

### `verifyFetchStream(url, options)`

Streaming verification with constant memory.

```typescript
const { stream, verified, totalBytes } = await verifyFetchStream('/file.bin', {
  sri: 'sha256-...',
  onProgress: (bytes, total) => {}
});

for await (const chunk of stream) {
  // Process immediately
}

await verified;  // Throws if verification fails
```

### `verifyFetchFromSources(sri, path, options)`

Multi-CDN failover.

```typescript
const response = await verifyFetchFromSources(
  'sha256-...',
  '/file.bin',
  {
    sources: ['https://cdn1.com', 'https://cdn2.com'],
    strategy: 'sequential',       // 'sequential' | 'race' | 'fastest'
    timeout: 30000,
    onSourceError: (source, error) => {}
  }
);
```

### `createVerifyFetcher(options)`

Manifest-aware fetcher.

```typescript
const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json',
  baseUrl: 'https://cdn.example.com'  // Optional
});

await vf.arrayBuffer('/file.wasm');
await vf.json('/config.json');
await vf.text('/data.txt');
```

### `createVerifyWorker(options)` (Service Worker)

Zero-code verification via Service Worker.

```typescript
// In sw.js
import { createVerifyWorker } from 'verifyfetch/worker';

createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx'],
  exclude: ['*.json'],
  onFail: 'block',                // 'block' | 'warn' | 'passthrough'
  cacheVerified: true,
  cacheName: 'verifyfetch-verified',
  debug: false
});
```

### `verifyFetchResumable(url, options)` (NEW in v1.0)

Resumable downloads with chunked verification. Persists progress to IndexedDB.

```typescript
const result = await verifyFetchResumable('/model.bin', {
  chunked: manifest.artifacts['/model.bin'].chunked, // Required
  persist: true,                    // Store progress in IndexedDB (default: true)
  onProgress: ({ bytesVerified, totalBytes, chunksVerified, totalChunks, resumed, speed, eta }) => {},
  onResume: (state) => {},          // Called when resuming
  chunkTimeout: 30000               // Timeout per chunk request
});

// result: { data: ArrayBuffer, resumed: boolean, chunksResumed: number, totalChunks: number }
```

**Utility functions:**

```typescript
import { canResume, getDownloadProgress, cancelDownload } from 'verifyfetch';

// Check if a download can be resumed
const resumable = await canResume('/model.bin');

// Get progress of paused download
const progress = await getDownloadProgress('/model.bin');
// { chunksVerified, totalChunks, bytesVerified, totalBytes, startedAt, lastUpdated }

// Cancel and clear a download
await cancelDownload('/model.bin');
```

### Chunked Verification Functions

```typescript
import { generateChunkedHashes, createChunkedVerifier, verifyChunk } from 'verifyfetch';

// Generate chunk hashes from data
const chunked = await generateChunkedHashes(data, 1048576); // 1MB chunks
// { root: 'sha256-...', chunkSize: 1048576, hashes: ['sha256-...', ...] }

// Create verifier for streaming
const verifier = createChunkedVerifier(chunked);
const result = await verifier.verifyNextChunk(chunk);
// { valid: boolean, index: number }

// Verify single chunk
const isValid = await verifyChunk(chunk, 'sha256-...');
```

---

## Manifest Format

### v1 (Simple)

```json
{
  "version": 1,
  "base": "/",
  "artifacts": {
    "/engine.wasm": {
      "sri": "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek="
    }
  }
}
```

### v2 (With Chunked Verification)

```json
{
  "version": 2,
  "base": "/",
  "artifacts": {
    "/large-model.bin": {
      "sri": "sha256-fullFileHash...",
      "size": 4294967296,
      "chunked": {
        "root": "sha256-rootHash...",
        "chunkSize": 1048576,
        "hashes": ["sha256-chunk0...", "sha256-chunk1...", "..."]
      }
    }
  }
}
```

---

## Examples

See [`examples/`](./examples) for working code:

- **[node-cli](./examples/node-cli/)** — Node.js usage
- **[next-app](./examples/next-app/)** — Next.js + React hook
- **[vite-app](./examples/vite-app/)** — Vite + TypeScript

---

<details>
<summary><strong>Troubleshooting</strong></summary>

### IntegrityError: Hash mismatch

**Cause:** File content doesn't match expected SRI hash.

**Solutions:**
1. **File changed legitimately** — Regenerate:
   ```bash
   npx verifyfetch sign ./path/to/file.bin
   ```
2. **CDN serving stale cache** — Clear CDN cache or use versioned URLs
3. **Potential attack** — Investigate immediately

### WASM not loading

**Symptoms:** Console shows "Using SubtleCrypto fallback"

**Solutions:**
1. Serve WASM with correct MIME type (`application/wasm`)
2. Check CSP headers allow `wasm-eval`

**Check status:**
```typescript
import { isUsingWasm } from 'verifyfetch';

if (!await isUsingWasm()) {
  console.warn('WASM not available');
}
```

### Memory issues with large files

Use streaming instead of buffered:

```typescript
// Instead of verifyFetch (buffers entire file)
const { stream, verified } = await verifyFetchStream('/large.bin', {
  sri: 'sha256-...'
});

for await (const chunk of stream) {
  // Process incrementally
}
await verified;
```

### Service Worker not intercepting

1. Ensure manifest URL is accessible
2. Check `include` patterns match your files
3. Enable `debug: true` for logging

</details>

<details>
<summary><strong>Security Model</strong></summary>

VerifyFetch uses the same trust model as browser SRI:

**Protects against:**
- CDN/storage compromise
- MITM attacks
- Accidental file corruption

**Does NOT protect against:**
- Compromised build (you ship wrong hash)
- Malicious insider (wrong hash intentional)

For build protection, use `verifyfetch enforce` in CI.

</details>

<details>
<summary><strong>Technical Notes</strong></summary>

### About "Chunked Verification"

The chunked verification feature hashes each chunk independently. This is simpler than a true Merkle tree (no hierarchical hashing, no proof-of-inclusion). The benefit is fail-fast: detect corruption at chunk N without downloading chunks N+1 through END.

The "root" hash is computed by concatenating all chunk hashes and hashing the result. This verifies the chunk list wasn't modified but doesn't provide Merkle proofs.

### Memory Usage

| Mode | Memory |
|------|--------|
| Native `crypto.subtle.digest()` | ~file size |
| `verifyFetch()` | ~file size (buffered) |
| `verifyFetchStream()` | ~2MB constant |
| Chunked verification | ~chunkSize + overhead |

</details>

<details>
<summary><strong>Limitations</strong></summary>

**What VerifyFetch does NOT do:**

- **Build verification** - If your build process is compromised, you'll ship wrong hashes. Use `verifyfetch enforce` in CI.
- **Key management** - No signature verification (yet). You trust whoever generates the manifest.
- **Offline-first** - Manifests are fetched on load. No offline cache (yet).

**Memory caveat:**

- **WASM required for true streaming** - Without WASM, SubtleCrypto buffers the entire file in memory. A warning is shown at 50MB+. WASM loads automatically if available.

**Browser requirements:**

- Crypto: `crypto.subtle` (all modern browsers)
- Streaming: `ReadableStream` (all modern browsers)
- Resumable: `IndexedDB` (all modern browsers)
- WASM hashing: `WebAssembly` (optional, falls back to SubtleCrypto)

</details>

<details>
<summary><strong>Contributing</strong></summary>

```bash
pnpm install
pnpm build:wasm   # Requires Rust
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

</details>

---

<p align="center">
  If this helps protect your app, consider giving it a <a href="https://github.com/hamzaydia/verifyfetch">star</a>
</p>

<p align="center">
  <a href="https://verifyfetch.com">Docs</a> •
  <a href="https://github.com/hamzaydia/verifyfetch">GitHub</a>
</p>

<p align="center">
  <sub>Apache-2.0 License</sub>
</p>
