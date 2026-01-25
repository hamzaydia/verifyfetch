/**
 * VerifyFetch Vite Example
 *
 * Demonstrates verified fetching of CDN assets in a Vite application.
 */

import { verifyFetch, isUsingWasm, type SRIString } from 'verifyfetch';

// CDN assets with their SRI hashes
const ASSETS = {
  json: {
    url: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/package.json',
    sri: 'sha256-jkGwfHRKDeDSwcI+1BQY7LCEmrtWOV0ogC5gG0cw18I=' as SRIString,
  },
  js: {
    url: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js',
    sri: 'sha256-qXBd/EfAdjOA2FGrGAG+b3YBn2tn5A6bhz+LSgYD96k=' as SRIString,
  },
};

// DOM elements
const progressEl = document.getElementById('progress') as HTMLDivElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const fetchJsonBtn = document.getElementById('fetch-json') as HTMLButtonElement;
const fetchJsBtn = document.getElementById('fetch-js') as HTMLButtonElement;

// Show result
function showResult(message: string, isError = false) {
  resultEl.className = `result ${isError ? 'error' : 'success'}`;
  resultEl.textContent = message;
}

// Update progress bar
function updateProgress(percent: number) {
  progressEl.style.width = `${percent}%`;
}

// Fetch and verify an asset
async function fetchAsset(type: 'json' | 'js') {
  const asset = ASSETS[type];
  updateProgress(0);
  resultEl.textContent = '';

  // Disable buttons during fetch
  fetchJsonBtn.disabled = true;
  fetchJsBtn.disabled = true;

  try {
    const response = await verifyFetch(asset.url, {
      sri: asset.sri,
      onProgress: (bytes, total) => {
        if (total) {
          updateProgress(Math.round((bytes / total) * 100));
        }
      },
    });

    updateProgress(100);

    if (type === 'json') {
      const data = await response.json();
      showResult(`✓ Verified JSON!\n\nPackage: ${data.name}@${data.version}\nDescription: ${data.description}`);
    } else {
      const text = await response.text();
      showResult(`✓ Verified JavaScript!\n\nSize: ${text.length.toLocaleString()} characters\nFirst 100 chars: ${text.slice(0, 100)}...`);
    }
  } catch (error) {
    showResult(`✗ Verification failed!\n\n${error instanceof Error ? error.message : 'Unknown error'}`, true);
  } finally {
    fetchJsonBtn.disabled = false;
    fetchJsBtn.disabled = false;
  }
}

// Event listeners
fetchJsonBtn.addEventListener('click', () => fetchAsset('json'));
fetchJsBtn.addEventListener('click', () => fetchAsset('js'));

// Check WASM status on load
isUsingWasm().then((using) => {
  console.log(`[VerifyFetch] Using ${using ? 'WASM' : 'SubtleCrypto'} hasher`);
});
