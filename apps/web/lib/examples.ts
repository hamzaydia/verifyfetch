export const codeExamples = {
  basic: {
    title: 'Basic',
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

  streaming: {
    title: 'Streaming',
    code: `import { verifyFetchStream } from 'verifyfetch';

// Stream large files with constant ~2MB memory usage
const { stream, verified } = await verifyFetchStream('/model.bin', {
  sri: 'sha256-abc123...'
});

// Process chunks as they arrive - no buffering!
for await (const chunk of stream) {
  await uploadToGPU(chunk); // Process immediately
}

// Final verification - throws if hash doesn't match
await verified;
console.log('Streaming verification complete!');`,
  },

  merkle: {
    title: 'Merkle Tree',
    code: `import { createMerkleVerifier } from 'verifyfetch';

// Fail-fast verification for large files
// Detects corruption at the first bad chunk!
const verifier = createMerkleVerifier(merkleInfo);

for await (const chunk of stream) {
  const result = await verifier.verifyNextChunk(chunk);

  if (!result.valid) {
    // Stop immediately - don't download corrupted data
    throw new Error(\`Chunk \${result.index} corrupted!\`);
  }

  await processChunk(chunk);
}

// Generate Merkle manifests with CLI:
// npx verifyfetch sign --merkle ./large-model.bin`,
  },

  worker: {
    title: 'Service Worker',
    code: `// sw.js - One-time setup, zero code changes needed!
import { createVerifyWorker } from 'verifyfetch/worker';

createVerifyWorker({
  manifestUrl: '/vf.manifest.json',
  include: ['*.wasm', '*.bin', '*.onnx', '*.safetensors'],
  onFail: 'block' // or 'warn', 'redirect'
});

// app.js - Your existing code works unchanged!
// All matching fetches are automatically verified
const model = await fetch('/model.bin');  // ✓ Auto-verified
const wasm = await fetch('/engine.wasm'); // ✓ Auto-verified
const json = await fetch('/data.json');   // ✗ Not matched, passes through`,
  },

  multicdn: {
    title: 'Multi-CDN',
    code: `import { verifyFetchFromSources } from 'verifyfetch';

// Automatic failover across CDNs
// If one CDN is compromised or down, tries the next
const response = await verifyFetchFromSources(
  'sha256-abc123...',  // Expected hash
  '/model.bin',         // File path
  {
    sources: [
      'https://cdn1.example.com',
      'https://cdn2.example.com',
      'https://backup.example.com'
    ],
    strategy: 'race' // 'race' | 'sequential' | 'fastest'
  }
);

// First source to return valid content wins!
const data = await response.arrayBuffer();`,
  },

  manifest: {
    title: 'Manifest',
    code: `import { createVerifyFetcher } from 'verifyfetch';

// Create fetcher that auto-loads manifest
const vf = await createVerifyFetcher({
  manifestUrl: '/vf.manifest.json'
});

// Fetch files - hashes looked up automatically
const model = await vf.arrayBuffer('/models/phi-3.bin');
const config = await vf.json('/config/settings.json');
const wasm = await vf.arrayBuffer('/engine.wasm');

// Manifest v2 format (with optional Merkle support):
// {
//   "version": 2,
//   "artifacts": {
//     "/model.bin": {
//       "sri": "sha256-...",
//       "merkle": { "root": "...", "chunkSize": 1048576 }
//     }
//   }
// }`,
  },

  progress: {
    title: 'Progress',
    code: `import { verifyFetch } from 'verifyfetch';

// Track download progress for large files
const response = await verifyFetch('/large-model.bin', {
  sri: 'sha256-abc123...',
  onProgress: (bytesProcessed, totalBytes) => {
    if (totalBytes) {
      const percent = (bytesProcessed / totalBytes) * 100;
      updateProgressBar(percent);
      console.log(\`Progress: \${percent.toFixed(1)}%\`);
    } else {
      console.log(\`Downloaded: \${bytesProcessed} bytes\`);
    }
  }
});

console.log('Download complete and verified!');`,
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
