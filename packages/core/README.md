<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="70" alt="VerifyFetch" />
</p>

<h1 align="center">verifyfetch</h1>

<p align="center">
  Download large files. Verify them. Resume when it fails.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/v/verifyfetch.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/verifyfetch"><img src="https://img.shields.io/npm/dm/verifyfetch.svg" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/verifyfetch"><img src="https://img.shields.io/bundlephobia/minzip/verifyfetch" alt="bundle size" /></a>
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
// Throws if hash doesn't match
```

## The Problem

**Download a 4GB AI model. Network drops at 3.8GB. Start over.**

Also:
- Native `crypto.subtle.digest()` buffers entire file = 4GB model needs 4GB RAM
- No way to detect corruption until after downloading everything

## The Solution

| Problem | VerifyFetch |
|---------|-------------|
| Memory explosion | Streaming verification (2MB constant) |
| Resume downloads | Persist to IndexedDB, resume from last chunk |
| Late corruption detection | Fail-fast at first bad chunk |

## Use Cases

- **AI models** - WebLLM, Transformers.js, ONNX (multi-GB files)
- **WASM modules** - Game engines, video codecs
- **Large data** - Fonts, images, datasets

## API

```typescript
// Basic verification
verifyFetch(url, { sri: 'sha256-...' })

// Streaming (constant memory)
verifyFetchStream(url, { sri: 'sha256-...' })

// Resumable (survives page reload)
verifyFetchResumable(url, { chunked: {...}, persist: true })

// Multi-CDN failover
verifyFetchFromSources(sri, path, { sources: [...] })

// Service Worker (automatic verification)
createVerifyWorker({ manifestUrl: '/vf.manifest.json' })
```

## Important Notes

- **WASM for streaming**: True constant-memory streaming requires WASM. Without it, files >50MB are buffered (warning shown in console).
- **SRI format**: Hashes use [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) format (`sha256-BASE64...`)
- **Resumable downloads**: Requires server support for HTTP Range requests.

## Full Documentation

See [GitHub README](https://github.com/hamzaydia/verifyfetch) for:
- Complete API reference
- Manifest format
- CLI commands
- Examples

## Generate Hashes

```bash
npx @verifyfetch/cli sign ./public/*.wasm
npx @verifyfetch/cli sign --chunked ./large-model.bin  # For resumable downloads
```

## License

Apache-2.0
