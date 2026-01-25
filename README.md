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

## Why?

Browser SRI only works on `<script>` tags. **`fetch()` has no protection.**

Your WASM modules, AI models, and binary files? Completely unverified. One CDN compromise = malicious code in your users' browsers. [It's happened before.](https://sansec.io/research/polyfill-supply-chain-attack)

### The Problem with Native Solutions

Native `crypto.subtle.digest()` loads the **entire file into memory** before hashing:

| File Size | Native | VerifyFetch |
|-----------|--------|-------------|
| 100 MB | ✅ Works | ✅ Works |
| 1 GB | ⚠️ Slow, RAM spike | ✅ 2MB memory |
| **4 GB AI model** | ❌ **Browser crash** | ✅ **2MB memory** |

VerifyFetch uses WASM streaming—constant memory for **any** file size.

---

## Generate Hashes

```bash
# Generate hashes for your files
npx verifyfetch sign ./public/*.wasm ./models/*.bin

# Output: vf.manifest.json with all SRI hashes
```

## Use in CI

```bash
# Fails if files changed after signing
npx verifyfetch enforce --manifest ./public/vf.manifest.json
```

---

## Features

<table>
<tr>
<td width="50%">

**Fallback URLs**
```typescript
await verifyFetch('/main.wasm', {
  sri: 'sha256-...',
  onFail: { fallbackUrl: '/backup.wasm' }
});
```

</td>
<td width="50%">

**Progress Tracking**
```typescript
await verifyFetch('/large-model.bin', {
  sri: 'sha256-...',
  onProgress: (bytes, total) => {
    console.log(`${bytes}/${total}`);
  }
});
```

</td>
</tr>
<tr>
<td>

**Manifest Mode**
```typescript
const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

await vf.arrayBuffer('/model.bin');
// Hash looked up automatically
```

</td>
<td>

**Works Everywhere**
```typescript
// Browser, Node, Deno, Bun, Workers
// Same API. Same protection.
await verifyFetch(url, { sri });
```

</td>
</tr>
</table>

---

## Full API Reference

### `verifyFetch(url, options)`

```typescript
const response = await verifyFetch('/file.bin', {
  sri: 'sha256-...',              // Required
  onFail: 'block',                // 'block' | 'warn' | { fallbackUrl }
  onProgress: (bytes, total) => {}
});
```

### `createVerifyFetcher(options)`

```typescript
const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json',
  publicKeys: [PEM_KEY]           // Optional, for signatures
});

await vf.arrayBuffer('/file.wasm');
await vf.json('/config.json');
await vf.text('/data.txt');
```

### CLI Commands

```bash
verifyfetch sign <files...>     # Generate SRI hashes
verifyfetch enforce             # Verify in CI
verifyfetch init --next         # Add to Next.js project
```

### Manifest Format

```json
{
  "version": 1,
  "base": "/",
  "artifacts": {
    "/engine.wasm": { "sri": "sha256-..." }
  }
}
```

---

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
  <a href="https://verifyfetch.com">Docs</a> •
  <a href="https://github.com/hamzaydia/verifyfetch">GitHub</a>
</p>

<p align="center">
  <sub>Apache-2.0 License</sub>
</p>
