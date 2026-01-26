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

Browser SRI only works on `<script>` tags. **`fetch()` has no protection.** ([W3C issue open since 2017](https://github.com/w3c/webappsec-subresource-integrity/issues/68))

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
  baseUrl: 'https://cdn.example.com'  // Optional
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

## Examples

See [`examples/`](./examples) for working code:

- **[node-cli](./examples/node-cli/)** — Node.js usage
- **[next-app](./examples/next-app/)** — Next.js + React hook
- **[vite-app](./examples/vite-app/)** — Vite + TypeScript

---

<details>
<summary><strong>Troubleshooting</strong></summary>

### IntegrityError: Hash mismatch

**Cause:** The file content doesn't match the expected SRI hash.

**Solutions:**
1. **File changed legitimately** - Regenerate the hash:
   ```bash
   npx verifyfetch sign ./path/to/file.bin
   ```
2. **CDN serving stale cache** - Clear CDN cache or use versioned URLs
3. **Potential attack** - Investigate the source immediately

### WASM not loading / SubtleCrypto fallback

**Symptoms:** Console shows "Using SubtleCrypto fallback" or memory warning for large files.

**Solutions:**
1. Ensure WASM files are served with correct MIME type (`application/wasm`)
2. Check CSP headers allow `wasm-eval` if using strict CSP
3. For large files (>50MB), SubtleCrypto fallback buffers the entire file—ensure WASM works for best performance

**Check WASM status:**
```typescript
import { isUsingWasm } from 'verifyfetch';

if (!await isUsingWasm()) {
  console.warn('WASM not available, using SubtleCrypto fallback');
}
```

### Network errors

**"Response body is null"** - The fetch completed but returned no body. This can happen with:
- HEAD requests (use GET instead)
- Some proxy configurations

**"Failed to fetch"** - Network request failed. Check:
- CORS configuration on the server
- Network connectivity
- URL is correct

### Memory issues with large files

VerifyFetch uses constant ~2MB memory **when WASM is available**. If you see memory spikes:

1. Check if WASM is loading (see above)
2. SubtleCrypto fallback buffers the entire file—expected behavior, but not ideal for multi-GB files

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
  If this helps protect your app, consider giving it a ⭐
</p>

<p align="center">
  <a href="https://verifyfetch.com">Docs</a> •
  <a href="https://github.com/hamzaydia/verifyfetch">GitHub</a>
</p>

<p align="center">
  <sub>Apache-2.0 License</sub>
</p>
