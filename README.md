<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="80" alt="VerifyFetch" />
</p>

<h1 align="center">VerifyFetch</h1>

<p align="center">
  <strong>Verify any file you fetch—before you trust it.</strong>
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

[CDN compromises happen.](https://sansec.io/research/polyfill-supply-chain-attack) When polyfill.io was compromised, 100M+ sites were affected.

Native `fetch({ integrity })` exists, but VerifyFetch gives you:

| Feature | Native `fetch` | VerifyFetch |
|---------|---------------|-------------|
| Basic SRI verification | Yes | Yes |
| **Progress callbacks** | No | Yes |
| **Streaming output** | No | Yes |
| **Service Worker mode** | No | Yes |
| **Merkle tree (fail-fast)** | No | Yes |
| **Multi-CDN failover** | No | Yes |
| **Manifest system** | No | Yes |
| **CI/CD enforcement** | No | Yes |

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

## Generate Hashes

```bash
# Generate SHA-256 hashes
npx verifyfetch sign ./public/*.wasm ./models/*.bin

# With Merkle tree (for large files - enables fail-fast verification)
npx verifyfetch sign --merkle --chunk-size 1048576 ./large-model.bin

# Output: vf.manifest.json
```

---

## Features

### Streaming Verification

For large files, process chunks as they download:

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

### Merkle Tree Verification (Fail-Fast)

Stop downloading immediately if corruption is detected:

```typescript
import { createMerkleVerifier, verifyFetchStream } from 'verifyfetch';

// Generate manifest with Merkle tree
// npx verifyfetch sign --merkle ./large-model.bin

// Verify chunk-by-chunk
const verifier = createMerkleVerifier(manifest.artifacts['/model.bin'].merkle);

const { stream } = await verifyFetchStream('/model.bin', { sri: merkle.root });

for await (const chunk of stream) {
  const result = await verifier.verifyNextChunk(chunk);

  if (!result.valid) {
    // Don't download 4GB if byte 0 is wrong!
    throw new Error(`Chunk ${result.index} corrupt - stopping immediately`);
  }

  await processChunk(chunk);
}
```

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

Or use content-addressable URLs:

```typescript
import { resolveContentAddressable } from 'verifyfetch';

// The hash IS the URL - fetch from any source
const response = await resolveContentAddressable(
  'vf://sha256/uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=/model.bin',
  ['https://cdn1.example.com', 'https://cdn2.example.com']
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

# Generate with Merkle tree (for large files)
npx verifyfetch sign --merkle --chunk-size 1048576 <files...>

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

### `registerVerifyWorker(swUrl)` (Client-Side)

Register the Service Worker from your app.

```typescript
// In your app entry point
import { registerVerifyWorker } from 'verifyfetch/worker';

await registerVerifyWorker('/sw.js');
// All matching fetches now automatically verified!
```

### Merkle Tree Functions

```typescript
import { generateMerkleTree, createMerkleVerifier, verifyChunk } from 'verifyfetch';

// Generate Merkle tree from data
const merkle = await generateMerkleTree(data, 1048576); // 1MB chunks
// { root: 'sha256-...', chunkSize: 1048576, tree: ['sha256-...', ...] }

// Create verifier for streaming
const verifier = createMerkleVerifier(merkle);
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

### v2 (With Merkle Tree)

```json
{
  "version": 2,
  "base": "/",
  "artifacts": {
    "/large-model.bin": {
      "sri": "sha256-rootHash...",
      "merkle": {
        "root": "sha256-rootHash...",
        "chunkSize": 1048576,
        "tree": ["sha256-chunk0...", "sha256-chunk1...", "..."]
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
