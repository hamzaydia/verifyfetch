# VerifyFetch Node.js Example

This example demonstrates using VerifyFetch in a Node.js environment.

## Setup

```bash
# From the monorepo root
pnpm install

# Or from this directory
npm install
```

## Run

```bash
npm start
```

## What it demonstrates

1. **Basic verification** - Fetch a file with inline SRI hash
2. **Manifest-based verification** - Use a manifest for automatic SRI lookup
3. **Computing SRI hashes** - Generate hashes for your own files
4. **Progress tracking** - Monitor download progress for large files
5. **WASM status** - Check if WASM hasher is available

## Output

```
╔═══════════════════════════════════════╗
║   VerifyFetch Node.js Examples        ║
╚═══════════════════════════════════════╝

=== Example 5: WASM Status ===

⚠ Using SubtleCrypto fallback (buffers entire file)

=== Example 1: Basic Verification ===

✓ Verification successful!
  Package: lodash@4.17.21

...
```
