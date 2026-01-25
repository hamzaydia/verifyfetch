# VerifyFetch Next.js Example

This example demonstrates using VerifyFetch in a Next.js 15 application with React 19.

## Features

- Custom `useVerifiedFetch` hook with progress tracking
- Client-side verified fetching
- Error handling and loading states

## Setup

```bash
# From the monorepo root
pnpm install

# Or from this directory
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the demo.

## Key Files

- `src/hooks/useVerifiedFetch.ts` - React hook for verified fetching
- `src/app/page.tsx` - Demo page with interactive example

## The Hook

```tsx
import { useVerifiedFetch } from './hooks/useVerifiedFetch';

function MyComponent() {
  const { data, loading, error, progress, fetch } = useVerifiedFetch();

  const handleLoad = async () => {
    const buffer = await fetch('/model.bin', 'sha256-...');
    // Use the verified buffer
  };

  return (
    <button onClick={handleLoad} disabled={loading}>
      {loading ? `Loading ${progress}%` : 'Load Model'}
    </button>
  );
}
```
