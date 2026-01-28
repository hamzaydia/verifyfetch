/**
 * VerifyFetch Vite Example
 *
 * Demonstrates verified fetching of CDN assets in a Vite application,
 * including streaming verification.
 */

import { verifyFetch, verifyFetchStream, isUsingWasm, type SRIString } from 'verifyfetch';

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

// DOM elements - Basic fetch
const progressEl = document.getElementById('progress') as HTMLDivElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const fetchJsonBtn = document.getElementById('fetch-json') as HTMLButtonElement;
const fetchJsBtn = document.getElementById('fetch-js') as HTMLButtonElement;

// DOM elements - Streaming fetch
const streamProgressEl = document.getElementById('stream-progress') as HTMLDivElement;
const streamResultEl = document.getElementById('stream-result') as HTMLDivElement;
const fetchStreamBtn = document.getElementById('fetch-stream') as HTMLButtonElement;

// Show result
function showResult(el: HTMLDivElement, message: string, isError = false) {
  el.className = `result ${isError ? 'error' : 'success'}`;
  el.textContent = message;
}

// Update progress bar
function updateProgress(el: HTMLDivElement, percent: number) {
  el.style.width = `${percent}%`;
}

// Disable all buttons
function setButtonsDisabled(disabled: boolean) {
  fetchJsonBtn.disabled = disabled;
  fetchJsBtn.disabled = disabled;
  fetchStreamBtn.disabled = disabled;
}

// Basic buffered fetch (verifyFetch)
async function fetchAsset(type: 'json' | 'js') {
  const asset = ASSETS[type];
  updateProgress(progressEl, 0);
  resultEl.textContent = '';
  setButtonsDisabled(true);

  try {
    const response = await verifyFetch(asset.url, {
      sri: asset.sri,
      onProgress: (bytes, total) => {
        if (total) {
          updateProgress(progressEl, Math.round((bytes / total) * 100));
        }
      },
    });

    updateProgress(progressEl, 100);

    if (type === 'json') {
      const data = await response.json();
      showResult(resultEl, `✓ Verified JSON!\n\nPackage: ${data.name}@${data.version}\nDescription: ${data.description}`);
    } else {
      const text = await response.text();
      showResult(resultEl, `✓ Verified JavaScript!\n\nSize: ${text.length.toLocaleString()} characters\nFirst 100 chars: ${text.slice(0, 100)}...`);
    }
  } catch (error) {
    showResult(resultEl, `✗ Verification failed!\n\n${error instanceof Error ? error.message : 'Unknown error'}`, true);
  } finally {
    setButtonsDisabled(false);
  }
}

// Streaming fetch (verifyFetchStream) - constant memory
async function fetchStreamAsset() {
  const asset = ASSETS.js;
  updateProgress(streamProgressEl, 0);
  streamResultEl.textContent = '';
  setButtonsDisabled(true);

  let totalBytes = 0;
  let chunkCount = 0;

  try {
    const { stream, verified } = await verifyFetchStream(asset.url, {
      sri: asset.sri,
      onProgress: (bytes, total) => {
        if (total) {
          updateProgress(streamProgressEl, Math.round((bytes / total) * 100));
        }
      },
    });

    // Process chunks as they arrive - no buffering needed!
    // In a real app, you would upload to GPU, write to IndexedDB, etc.
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      chunkCount++;
    }

    // Wait for verification to complete
    await verified;

    updateProgress(streamProgressEl, 100);
    showResult(
      streamResultEl,
      `✓ Streaming verification complete!\n\nTotal bytes: ${totalBytes.toLocaleString()}\nChunks processed: ${chunkCount}\nMemory: Constant ~2MB (not ${Math.round(totalBytes / 1024)}KB)`
    );
  } catch (error) {
    showResult(streamResultEl, `✗ Streaming verification failed!\n\n${error instanceof Error ? error.message : 'Unknown error'}`, true);
  } finally {
    setButtonsDisabled(false);
  }
}

// Event listeners
fetchJsonBtn.addEventListener('click', () => fetchAsset('json'));
fetchJsBtn.addEventListener('click', () => fetchAsset('js'));
fetchStreamBtn.addEventListener('click', fetchStreamAsset);

// Check WASM status on load
isUsingWasm().then((using) => {
  console.log(`[VerifyFetch] Using ${using ? 'WASM' : 'SubtleCrypto'} hasher`);
  console.log('[VerifyFetch] v1.0.0 features: Streaming, Multi-CDN, Service Worker, Resumable Downloads');
});
