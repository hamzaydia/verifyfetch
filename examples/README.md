# VerifyFetch Examples

This folder contains example projects demonstrating how to use VerifyFetch in different environments.

## Examples

| Example | Description | Technologies |
|---------|-------------|--------------|
| [node-cli](./node-cli/) | Command-line usage in Node.js | Node.js, ESM |
| [next-app](./next-app/) | React app with custom hook | Next.js 15, React 19 |
| [vite-app](./vite-app/) | Vanilla TypeScript web app | Vite 6, TypeScript |

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

- Basic `verifyFetch()` usage
- Manifest-based verification with `createVerifyFetcher()`
- Computing SRI hashes with `computeSri()`
- Progress tracking
- WASM availability checking

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
