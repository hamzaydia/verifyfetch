<p align="center">
  <img src="https://raw.githubusercontent.com/hamzaydia/verifyfetch/main/.github/logo.svg" width="70" alt="VerifyFetch" />
</p>

<h1 align="center">@verifyfetch/cli</h1>

<p align="center">
  <strong>Generate SRI hashes and enforce integrity in CI/CD.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verifyfetch/cli"><img src="https://img.shields.io/npm/v/@verifyfetch/cli.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@verifyfetch/cli"><img src="https://img.shields.io/npm/dm/@verifyfetch/cli.svg" alt="npm downloads" /></a>
</p>

---

## Quick Start

```bash
# Generate hashes for your files
npx @verifyfetch/cli sign ./public/*.wasm ./models/*.bin

# Output: vf.manifest.json
```

## Commands

### `sign` — Generate SRI Hashes

```bash
npx @verifyfetch/cli sign <files...> [options]
```

| Option | Description |
|--------|-------------|
| `-o, --out <file>` | Output manifest path (default: `vf.manifest.json`) |
| `-a, --algorithm <alg>` | Hash algorithm: `sha256`, `sha384`, `sha512` (default: `sha256`) |
| `-b, --base <path>` | Base path for URLs (default: `/`) |
| `-u, --update` | Update existing manifest instead of replacing |
| `-c, --chunked` | Generate per-chunk hashes (for resumable downloads) |
| `--chunk-size <bytes>` | Chunk size in bytes (default: 1MB) |

**Examples:**

```bash
# Single file
npx @verifyfetch/cli sign ./public/app.wasm

# Multiple files with custom output
npx @verifyfetch/cli sign ./dist/*.js -o ./public/manifest.json

# Use SHA-384
npx @verifyfetch/cli sign ./models/* -a sha384

# For large files: enable resumable downloads
npx @verifyfetch/cli sign --chunked ./large-model.bin
```

### `enforce` — Verify in CI/CD

```bash
npx @verifyfetch/cli enforce [options]
```

| Option | Description |
|--------|-------------|
| `-m, --manifest <file>` | Manifest path (default: `vf.manifest.json`) |
| `-s, --strict` | Fail if extra files exist in directories |
| `-p, --base-path <path>` | Base path to resolve files from |

**Example CI usage:**

```yaml
# GitHub Actions
- name: Verify integrity
  run: npx @verifyfetch/cli enforce
```

Exits with code 1 if any file hash doesn't match — perfect for CI pipelines.

### `init` — Project Setup

```bash
npx @verifyfetch/cli init [options]
```

| Option | Description |
|--------|-------------|
| `--next` | Initialize for Next.js |
| `--vite` | Initialize for Vite |

## Manifest Format

**v1 (simple):**
```json
{
  "version": 1,
  "base": "/",
  "artifacts": {
    "/app.wasm": {
      "sri": "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek="
    }
  }
}
```

**v2 (with `--chunked` for resumable downloads):**
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

## Related

- [verifyfetch](https://www.npmjs.com/package/verifyfetch) — Core library
- [GitHub](https://github.com/hamzaydia/verifyfetch)

## License

Apache-2.0
