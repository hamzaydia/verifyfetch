# VerifyFetch Examples

This folder contains example projects demonstrating how to use VerifyFetch in different environments.

## Examples

| Example | Description | Technologies |
|---------|-------------|--------------|
| [node-cli](./node-cli/) | Command-line usage in Node.js | Node.js, ESM |
| [next-app](./next-app/) | React app with custom hook | Next.js 16, React 19 |
| [vite-app](./vite-app/) | Vanilla TypeScript web app | Vite 7, TypeScript |

## Running the Examples

### From the monorepo root:

```bash
# Install all dependencies
pnpm install

# Run a specific example
cd examples/node-cli && npm start
cd examples/next-app && npm run dev
cd examples/vite-app && npm run dev
```

### Standalone:

Each example can also be run independently:

```bash
cd examples/vite-app
npm install
npm run dev
```

## What each example demonstrates

### Node.js CLI (`node-cli`)

**Core Features:**
- Basic `verifyFetch()` usage
- Manifest-based verification with `createVerifyFetcher()` (v2 format)
- Computing SRI hashes with `computeSri()`
- Progress tracking
- WASM availability checking

**Streaming & Multi-CDN:**
- Streaming verification with `verifyFetchStream()` (constant memory)
- Multi-CDN failover with `verifyFetchFromSources()`

### Next.js App (`next-app`)

- Custom `useVerifiedFetch` React hook
- Client-side verified fetching
- Progress tracking in UI
- Error handling

### Vite App (`vite-app`)

- Vanilla TypeScript integration
- CDN asset verification
- Visual progress bar
- Multiple asset types (JSON, JavaScript)

---

## Features Quick Reference

### 1. Basic Verification

```typescript
import { verifyFetch } from 'verifyfetch';

const response = await verifyFetch('/model.bin', {
  sri: 'sha256-abc123...'
});
const data = await response.arrayBuffer();
```

### 2. Streaming Verification (Constant Memory)

For large files, use streaming to avoid buffering the entire file:

```typescript
import { verifyFetchStream } from 'verifyfetch';

const { stream, verified } = await verifyFetchStream('/model.bin', {
  sri: 'sha256-...'
});

// Process chunks immediately - no buffering!
for await (const chunk of stream) {
  await uploadToGPU(chunk);
}

await verified; // Throws if hash doesn't match
```

> **Note:** Basic `verifyFetch()` buffers the response (same as native fetch). Use `verifyFetchStream()` for large files to get constant ~2MB memory usage.

### 3. Service Worker Mode (Zero-Code)

Protect all fetches without changing your app code:

```typescript
// sw.js
import { createVerifyWorker } from 'verifyfetch/worker';

createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx'],
  onFail: 'block'
});

// app.js - No changes needed!
const model = await fetch('/model.bin'); // Auto-verified!
```

### 4. Multi-CDN Failover

Automatic failover if one CDN is compromised or down:

```typescript
import { verifyFetchFromSources } from 'verifyfetch';

const response = await verifyFetchFromSources(
  'sha256-abc123...',
  '/model.bin',
  {
    sources: [
      'https://cdn1.example.com',
      'https://cdn2.example.com',
    ],
    strategy: 'race' // or 'sequential', 'fastest'
  }
);
```

### 5. Manifest Mode

```typescript
import { createVerifyFetcher } from 'verifyfetch';

const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

// All fetches are now automatically verified
const model = await vf.arrayBuffer('/model.bin');
const config = await vf.json('/config.json');
```

### 6. Chunked Verification (Fail-Fast)

Generate chunked manifests for large files to detect corruption early:

```bash
# Generate with chunked hashes
npx verifyfetch sign --chunked ./large-model.bin

# Output includes chunk hashes for fail-fast verification
```

---

## Creating Your Own Integration

The simplest integration requires just two steps:

```typescript
import { verifyFetch } from 'verifyfetch';

// 1. Generate SRI hash (once, at build time)
// npx verifyfetch sign ./public/model.bin

// 2. Fetch with verification
const response = await verifyFetch('/model.bin', {
  sri: 'sha256-abc123...'
});
const data = await response.arrayBuffer();
```

For multiple files, use a manifest:

```typescript
import { createVerifyFetcher } from 'verifyfetch';

const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

// All fetches are now automatically verified
const model = await vf.arrayBuffer('/model.bin');
const config = await vf.json('/config.json');
```

---

## Feature Comparison

| Feature | Basic `verifyFetch()` | `verifyFetchStream()` |
|---------|----------------------|----------------------|
| Memory usage | O(n) - buffers response | O(1) - ~2MB constant |
| Best for | Small/medium files | Large files (AI models, WASM) |
| Output | Response object | Async iterator + Promise |

Choose based on your file sizes:
- **< 50MB**: `verifyFetch()` is simpler
- **> 50MB**: `verifyFetchStream()` for constant memory
