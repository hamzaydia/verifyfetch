<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="70" alt="VerifyFetch" />
</p>

<h1 align="center">verifyfetch</h1>

<p align="center">
  <strong>Verify any file you fetch—before you trust it.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/v/verifyfetch.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/dm/verifyfetch.svg" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/verifyfetch"><img src="https://img.shields.io/bundlephobia/minzip/verifyfetch" alt="bundle size" /></a>
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript" />
</p>

---

## Install

```bash
npm install verifyfetch
```

## Quick Start

```typescript
import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('/model.bin', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});
// Throws if hash doesn't match. Your users are protected.
```

## Why?

Browser SRI only works on `<script>` tags. **`fetch()` has no protection.**

Your WASM modules, AI models, and config files are fetched without any integrity verification. One CDN compromise = malicious code in your users' browsers.

### Memory Efficiency

Native `crypto.subtle.digest()` loads the **entire file into memory**. VerifyFetch streams with constant memory:

| File Size | Native `crypto.subtle` | VerifyFetch |
|-----------|------------------------|-------------|
| 100 MB    | 100 MB RAM             | **2 MB RAM** |
| 1 GB      | 1 GB RAM (crashes mobile) | **2 MB RAM** |
| 4 GB AI model | Browser crash | **2 MB RAM** |

## Features

**Fallback URLs** — Auto-retry from backup on failure
```typescript
await verifyFetch('/main.wasm', {
  sri: 'sha256-...',
  onFail: { fallbackUrl: '/backup.wasm' }
});
```

**Progress Tracking** — Monitor large downloads
```typescript
await verifyFetch('/model.bin', {
  sri: 'sha256-...',
  onProgress: (loaded, total) => console.log(`${loaded}/${total}`)
});
```

**Manifest Mode** — Manage multiple files
```typescript
import { createVerifyFetcher } from 'verifyfetch';

const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

await vf.arrayBuffer('/model.bin');  // Hash auto-looked up
```

## Generate Hashes

```bash
npx @verifyfetch/cli sign ./public/*.wasm
# Creates vf.manifest.json with SRI hashes
```

## API

### `verifyFetch(url, options)`

| Option | Type | Description |
|--------|------|-------------|
| `sri` | `string` | SRI hash (required). Format: `sha256-BASE64` |
| `onFail` | `'block' \| 'warn' \| { fallbackUrl }` | Failure behavior. Default: `'block'` |
| `onProgress` | `(loaded, total) => void` | Progress callback |

### `createVerifyFetcher(options)`

| Option | Type | Description |
|--------|------|-------------|
| `manifestUrl` | `string` | URL to manifest JSON |
| `manifest` | `object` | Inline manifest (alternative to URL) |
| `baseUrl` | `string` | Base URL for resolving paths |

Returns object with: `fetch()`, `arrayBuffer()`, `json()`, `text()`, `blob()`, `preload()`, `reloadManifest()`

## Use Cases

- **WebAssembly** — Verify `.wasm` modules before instantiation
- **AI Models** — Secure multi-GB model downloads (WebLLM, Transformers.js, ONNX)
- **Config Files** — Ensure critical JSON/YAML isn't tampered
- **Any Binary** — Fonts, images, data files

## Links

- [GitHub](https://github.com/hamzaydia/verifyfetch)
- [CLI Package](https://www.npmjs.com/package/@verifyfetch/cli)
- [Issues](https://github.com/hamzaydia/verifyfetch/issues)

## License

Apache-2.0
