# VerifyFetch Vite Example

This example demonstrates using VerifyFetch in a Vite 6 application with vanilla TypeScript.

## Features

- CDN asset verification with progress tracking
- Visual progress bar
- Error handling with user feedback

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

Open the URL shown in the terminal (usually http://localhost:5173).

## What it demonstrates

1. **JSON Verification** - Fetch and verify a package.json from jsDelivr
2. **JavaScript Verification** - Fetch and verify lodash.min.js from CDN
3. **Progress Tracking** - Visual progress bar during download
4. **Error Handling** - Clear error messages on verification failure

## Key Files

- `src/main.ts` - Main application code
- `index.html` - Demo page with UI
