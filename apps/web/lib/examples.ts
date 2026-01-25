export const codeExamples = {
  basic: {
    title: 'Basic Usage',
    code: `import { verifyFetch } from 'verifyfetch';

// Fetch and verify a file against its SRI hash
const response = await verifyFetch('/model.bin', {
  sri: 'sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
});

// If the hash doesn't match, an IntegrityError is thrown
// Otherwise, you get a normal Response object
const data = await response.arrayBuffer();
console.log('Verified! Size:', data.byteLength);`,
  },

  fallback: {
    title: 'With Fallback URL',
    code: `import { verifyFetch } from 'verifyfetch';

// If primary CDN is compromised, automatically try backup
const response = await verifyFetch('/engine.wasm', {
  sri: 'sha256-abc123def456...',
  onFail: {
    fallbackUrl: 'https://backup.cdn.com/engine.wasm'
  }
});

// You can also just warn instead of blocking
const wasm = await verifyFetch('/plugin.wasm', {
  sri: 'sha256-xyz789...',
  onFail: 'warn' // Logs warning but continues
});`,
  },

  progress: {
    title: 'Progress Tracking',
    code: `import { verifyFetch } from 'verifyfetch';

// Track download progress for large files
const response = await verifyFetch('/large-model.bin', {
  sri: 'sha256-abc123...',
  onProgress: (bytesProcessed, totalBytes) => {
    if (totalBytes) {
      const percent = (bytesProcessed / totalBytes) * 100;
      console.log(\`Progress: \${percent.toFixed(1)}%\`);
    } else {
      console.log(\`Downloaded: \${bytesProcessed} bytes\`);
    }
  }
});

console.log('Download complete and verified!');`,
  },

  manifest: {
    title: 'Manifest Mode',
    code: `import { createVerifyFetcher } from 'verifyfetch';

// Create fetcher (auto-loads manifest)
const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

// Fetch files - hashes looked up automatically
const model = await vf.arrayBuffer('/models/phi-3.bin');
const config = await vf.json('/config/settings.json');
const wasm = await vf.arrayBuffer('/engine.wasm');

// Manifest format:
// {
//   "version": 1,
//   "base": "/",
//   "artifacts": {
//     "/models/phi-3.bin": { "sri": "sha256-..." },
//     "/config/settings.json": { "sri": "sha256-..." }
//   }
// }`,
  },
};

export const memoryData = [
  { size: '10 MB', native: 10, verifyfetch: 2, label: '10 MB' },
  { size: '50 MB', native: 50, verifyfetch: 2, label: '50 MB' },
  { size: '100 MB', native: 100, verifyfetch: 2, label: '100 MB' },
  { size: '500 MB', native: 500, verifyfetch: 2, label: '500 MB' },
  { size: '1 GB', native: 1024, verifyfetch: 2, label: '1 GB' },
  { size: '2 GB', native: 2048, verifyfetch: 2, label: '2 GB' },
  { size: '4 GB', native: 4096, verifyfetch: 2, label: '4 GB' },
];
