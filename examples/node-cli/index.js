/**
 * VerifyFetch Node.js Example
 *
 * This example demonstrates how to use VerifyFetch to verify file integrity
 * in a Node.js environment.
 */

import {
  verifyFetch,
  verifyFetchStream,
  verifyFetchFromSources,
  createVerifyFetcher,
  computeSri,
  isUsingWasm,
} from 'verifyfetch';

// Example 1: Basic verification with inline SRI
async function basicVerification() {
  console.log('\n=== Example 1: Basic Verification ===\n');

  // Fetch a known file and verify its integrity
  const url = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/package.json';

  // Pre-computed SRI hash for this specific version
  const sri = 'sha256-jkGwfHRKDeDSwcI+1BQY7LCEmrtWOV0ogC5gG0cw18I=';

  try {
    const response = await verifyFetch(url, { sri });
    const data = await response.json();
    console.log('✓ Verification successful!');
    console.log(`  Package: ${data.name}@${data.version}`);
  } catch (error) {
    console.error('✗ Verification failed:', error.message);
  }
}

// Example 2: Using manifest-based verification (v2 format)
async function manifestVerification() {
  console.log('\n=== Example 2: Manifest-Based Verification (v2) ===\n');

  // Create a manifest inline (in production, load from file)
  // v2 format: no 'base' field, artifacts directly
  const manifest = {
    version: 2,
    artifacts: {
      '/lodash@4.17.21/package.json': {
        sri: 'sha256-jkGwfHRKDeDSwcI+1BQY7LCEmrtWOV0ogC5gG0cw18I=',
      },
    },
  };

  try {
    const vf = await createVerifyFetcher({
      manifest,
      baseUrl: 'https://cdn.jsdelivr.net/npm',
    });

    // Now fetch is simplified - SRI is looked up from manifest
    const data = await vf.json('/lodash@4.17.21/package.json');
    console.log('✓ Manifest verification successful!');
    console.log(`  Package: ${data.name}@${data.version}`);
  } catch (error) {
    console.error('✗ Manifest verification failed:', error.message);
  }
}

// Example 3: Computing SRI hashes
async function computeHashes() {
  console.log('\n=== Example 3: Computing SRI Hashes ===\n');

  const testData = new TextEncoder().encode('Hello, VerifyFetch!');

  // Compute hashes with different algorithms
  const sha256 = await computeSri(testData, 'sha256');
  const sha384 = await computeSri(testData, 'sha384');
  const sha512 = await computeSri(testData, 'sha512');

  console.log('Computed SRI hashes for "Hello, VerifyFetch!":');
  console.log(`  SHA-256: ${sha256}`);
  console.log(`  SHA-384: ${sha384}`);
  console.log(`  SHA-512: ${sha512}`);
}

// Example 4: Progress tracking for large files
async function progressTracking() {
  console.log('\n=== Example 4: Progress Tracking ===\n');

  const url = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js';
  const sri = 'sha256-qXBd/EfAdjOA2FGrGAG+b3YBn2tn5A6bhz+LSgYD96k=';

  try {
    const response = await verifyFetch(url, {
      sri,
      onProgress: (bytesProcessed, totalBytes) => {
        if (totalBytes) {
          const percent = Math.round((bytesProcessed / totalBytes) * 100);
          process.stdout.write(`\r  Progress: ${percent}% (${bytesProcessed}/${totalBytes} bytes)`);
        }
      },
    });

    console.log('\n✓ Download and verification complete!');
    console.log(`  Size: ${(await response.arrayBuffer()).byteLength} bytes`);
  } catch (error) {
    console.error('\n✗ Failed:', error.message);
  }
}

// Example 5: Streaming verification (constant memory)
async function streamingVerification() {
  console.log('\n=== Example 5: Streaming Verification ===\n');

  const url = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js';
  const sri = 'sha256-qXBd/EfAdjOA2FGrGAG+b3YBn2tn5A6bhz+LSgYD96k=';

  try {
    // verifyFetchStream returns a stream you can consume immediately
    // This enables constant memory usage for large files
    const { stream, verified } = await verifyFetchStream(url, { sri });

    let totalBytes = 0;
    let chunkCount = 0;

    // Process chunks as they arrive - no buffering needed
    for await (const chunk of stream) {
      totalBytes += chunk.length;
      chunkCount++;
      // In a real app: await uploadToGPU(chunk) or process immediately
    }

    // Wait for final verification
    await verified;

    console.log('✓ Streaming verification complete!');
    console.log(`  Total bytes: ${totalBytes}`);
    console.log(`  Chunks processed: ${chunkCount}`);
    console.log('  Memory: Constant ~2MB (streaming hash)');
  } catch (error) {
    console.error('✗ Streaming verification failed:', error.message);
  }
}

// Example 6: Multi-CDN failover
async function multiCdnFailover() {
  console.log('\n=== Example 6: Multi-CDN Failover ===\n');

  const sri = 'sha256-jkGwfHRKDeDSwcI+1BQY7LCEmrtWOV0ogC5gG0cw18I=';
  const path = '/npm/lodash@4.17.21/package.json';

  try {
    // Try multiple CDNs - first valid response wins
    const response = await verifyFetchFromSources(
      sri,
      path,
      {
        sources: [
          'https://cdn.jsdelivr.net',     // Primary
          'https://unpkg.com',            // Backup 1
          'https://cdnjs.cloudflare.com', // Backup 2
        ],
        strategy: 'sequential', // Try in order until one works
      }
    );

    const data = await response.json();
    console.log('✓ Multi-CDN fetch successful!');
    console.log(`  Package: ${data.name}@${data.version}`);
    console.log('  If one CDN is compromised or down, others are tried.');
  } catch (error) {
    console.error('✗ All CDNs failed:', error.message);
  }
}

// Example 7: Check WASM availability
async function checkWasm() {
  console.log('\n=== Example 7: WASM Status ===\n');

  const usingWasm = await isUsingWasm();

  if (usingWasm) {
    console.log('✓ Using WASM hasher for streaming hash computation');
    console.log('  Note: Use verifyFetchStream() for constant memory with large files.');
    console.log('  Basic verifyFetch() still buffers the response for convenience.');
  } else {
    console.log('⚠ Using SubtleCrypto fallback');
    console.log('  For better performance with large files, ensure WASM is available.');
  }
}

// Run all examples
async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   VerifyFetch Node.js Examples        ║');
  console.log('╚═══════════════════════════════════════╝');

  await checkWasm();
  await basicVerification();
  await manifestVerification();
  await computeHashes();
  await progressTracking();
  await streamingVerification();
  await multiCdnFailover();

  console.log('\n═══════════════════════════════════════');
  console.log('✓ All examples completed!');
  console.log('\nFeatures demonstrated:');
  console.log('  • Streaming verification (constant memory)');
  console.log('  • Multi-CDN failover');
  console.log('  • Manifest v2 format');
  console.log('\nBrowser-only features:');
  console.log('  • Service Worker mode (createVerifyWorker)');
  console.log('  • Chunked verification (use CLI: npx verifyfetch sign --chunked)');
}

main().catch(console.error);
