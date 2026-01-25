<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="120" alt="VerifyFetch Logo" />
</p>

<h1 align="center">VerifyFetch</h1>

<p align="center">
  <strong>Verify any file you fetch—before you trust it.</strong>
</p>

<p align="center">
  Streaming integrity verification for WASM, AI models, and large files.<br/>
  One function. Zero dependencies. Works everywhere fetch() does.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/v/verifyfetch?style=flat-square&color=10b981" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/dm/verifyfetch?style=flat-square&color=10b981" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/verifyfetch"><img src="https://img.shields.io/bundlephobia/minzip/verifyfetch?style=flat-square&color=10b981" alt="bundle size" /></a>
  <a href="https://github.com/hamzaydia/verifyfetch/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/verifyfetch?style=flat-square&color=10b981" alt="license" /></a>
  <a href="https://github.com/hamzaydia/verifyfetch"><img src="https://img.shields.io/github/stars/hamzaydia/verifyfetch?style=flat-square&color=10b981" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#why-verifyfetch">Why?</a> •
  <a href="#features">Features</a> •
  <a href="#api">API</a> •
  <a href="https://verifyfetch.com">Docs</a>
</p>

---

## The Problem

Browser's SRI only protects `<script>` and `<link>` tags. Everything loaded via `fetch()` is **completely unverified**:

- ⚠️ WASM modules
- ⚠️ AI models (WebLLM, Transformers.js, ONNX)
- ⚠️ 3D assets (GLTF, GLB)
- ⚠️ Data files, configs, any binary

**One CDN compromise = code execution in your users' browsers.**

Remember [Polyfill.io](https://sansec.io/research/polyfill-supply-chain-attack)? That's what happens when you trust URLs instead of content.

## The Solution

```typescript
import { verifyFetch } from 'verifyfetch';

// That's it. Verified or blocked.
const wasm = await verifyFetch('/engine.wasm', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});
```

## Quick Start

```bash
# Install
npm install verifyfetch

# Generate hashes for your assets
npx verifyfetch sign ./public/**/*.wasm ./public/models/*.bin

# Use in your code
```

```typescript
import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('/models/llama-3.bin', {
  sri: 'sha256-...' // from your manifest
});

const model = await response.arrayBuffer();
```

## Why VerifyFetch?

| Feature | Native SRI | Native fetch integrity | VerifyFetch |
|---------|-----------|------------------------|-------------|
| `<script>` tags | ✅ | ❌ | ✅ |
| `fetch()` responses | ❌ | ⚠️ Limited | ✅ |
| **Large files (>1GB)** | ❌ | ❌ Crashes | ✅ Streams |
| AI models (2-4GB) | ❌ | ❌ OOM | ✅ Works |
| Fallback URLs | ❌ | ❌ | ✅ |
| Progress callbacks | ❌ | ❌ | ✅ |
| Works in Workers | ✅ | ❌ | ✅ |

**The key insight:** Native `crypto.subtle.digest()` requires loading the **entire file into memory**. A 4GB AI model = 4GB RAM = browser crash. VerifyFetch streams verification using WASM, using constant ~2MB memory for **any** file size.

## Features

### ✅ One Function, Everywhere

```typescript
// Browser
const wasm = await verifyFetch('/engine.wasm', { sri: 'sha256-...' });

// Node.js
const model = await verifyFetch('https://cdn/model.bin', { sri: 'sha256-...' });

// Deno, Bun, Workers - same API
```

### ✅ AI Model Verification

```typescript
// Protect your users from model poisoning attacks
const model = await verifyFetch('/models/llama-3-8b.safetensors', {
  sri: 'sha384-...',
  onProgress: (bytes, total) => {
    console.log(`Verified ${bytes}/${total} bytes`);
  }
});
```

### ✅ Manifest-Based Fetching

```typescript
import { createVerifyFetcher } from 'verifyfetch';

const vf = createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

// One-liners - hashes looked up automatically
const wasm = await vf.arrayBuffer('/engine.wasm');
const model = await vf.arrayBuffer('/models/phi-3.bin');
```

### ✅ CI Enforcement

```bash
# In your CI pipeline
npx verifyfetch enforce --manifest ./public/vf.manifest.json

# Fails if any file was modified after signing
```

### ✅ Graceful Fallbacks

```typescript
const asset = await verifyFetch('/cdn/critical.wasm', {
  sri: 'sha256-...',
  onFail: { fallbackUrl: '/backup/critical.wasm' }
});
```

## API

### `verifyFetch(url, options)`

Fetch and verify a resource.

```typescript
const response = await verifyFetch('/file.bin', {
  sri: 'sha256-abc123...',           // Required: SRI hash
  onFail: 'block',                    // 'block' | 'warn' | { fallbackUrl }
  onProgress: (bytes, total) => {},   // Progress callback
});
```

### `createVerifyFetcher(options)`

Create a manifest-aware fetcher.

```typescript
const vf = createVerifyFetcher({
  manifestUrl: '/vf.manifest.json',
  publicKeys: [PUBLIC_KEY_PEM],  // Optional: for signatures
});

const data = await vf.arrayBuffer('/engine.wasm');
const json = await vf.json('/config.json');
```

### CLI

```bash
# Sign files and generate manifest
npx verifyfetch sign ./public/**/*.wasm --out ./public/vf.manifest.json

# Verify manifest in CI
npx verifyfetch enforce --manifest ./public/vf.manifest.json

# Initialize in project (generates ownable code)
npx verifyfetch init --next
```

## Framework Integrations

### Next.js

```bash
npx verifyfetch init --next
```

```typescript
// lib/verify-fetch.ts is now yours to own and modify
import { useVerifiedFetch } from '@/lib/verify-fetch';

function ModelLoader() {
  const { data, loading } = useVerifiedFetch('/model.bin', {
    sri: 'sha256-...'
  });

  if (loading) return <Spinner />;
  return <Model data={data} />;
}
```

### Zero-Config Mode (Coming Soon)

```javascript
// next.config.js
const { withVerifyFetch } = require('verifyfetch/next');
module.exports = withVerifyFetch({});
// All public assets auto-verified. Done.
```

## Manifest Format

```json
{
  "version": 1,
  "base": "/",
  "artifacts": {
    "/engine.wasm": { "sri": "sha256-..." },
    "/models/phi-3.bin": { "sri": "sha384-..." }
  }
}
```

## Performance

| File Size | Native (buffered) | VerifyFetch (streaming) |
|-----------|-------------------|-------------------------|
| 10 MB | ✅ 50ms | ✅ 52ms |
| 100 MB | ✅ 400ms | ✅ 420ms |
| 1 GB | ⚠️ 4s + RAM spike | ✅ 4.2s, constant 2MB |
| 4 GB | ❌ OOM crash | ✅ 17s, constant 2MB |

*Measured on M1 MacBook Pro, Chrome 120*

## Security Model

VerifyFetch operates on the same trust model as browser SRI:

- **You** embed the expected hash in your code
- **VerifyFetch** verifies downloaded bytes match that hash
- If they don't match → blocked (or warn/fallback per your config)

This protects against:
- ✅ CDN compromise
- ✅ MITM attacks (even with broken TLS termination)
- ✅ Storage corruption
- ✅ Accidental file swaps

This does NOT protect against:
- ❌ Compromised build pipeline (your code ships wrong hash)
- ❌ Malicious developer (they set wrong hash intentionally)

For build pipeline protection, combine with CI enforcement:

```yaml
- name: Verify Integrity
  run: npx verifyfetch enforce --manifest ./public/vf.manifest.json
```

## Sponsors

<p align="center">
  <a href="https://github.com/sponsors/hamzaydia">
    <img src="https://img.shields.io/badge/sponsor-verifyfetch-ea4aaa?style=for-the-badge&logo=github-sponsors" alt="Sponsor" />
  </a>
</p>

VerifyFetch is free and open source. If it helps protect your users, please consider [sponsoring](https://github.com/sponsors/hamzaydia).

### Gold Sponsors

*Your logo here - [become a sponsor](https://github.com/sponsors/hamzaydia)*

### Silver Sponsors

*Your logo here - [become a sponsor](https://github.com/sponsors/hamzaydia)*

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Setup
pnpm install

# Build WASM
pnpm build:wasm

# Build everything
pnpm build

# Run tests
pnpm test
```

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ❤️ by the VerifyFetch team</sub><br/>
  <sub><a href="https://verifyfetch.com">verifyfetch.com</a> • <a href="https://github.com/hamzaydia/verifyfetch">GitHub</a> • <a href="https://twitter.com/verifyfetch">Twitter</a></sub>
</p>
