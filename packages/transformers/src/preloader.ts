/**
 * Model Preloader
 *
 * Download and verify model files before Transformers.js loads them.
 * Files are stored in Cache API where Transformers.js will find them.
 */

import {
  verifyFetch,
  verifyFetchResumable,
  IntegrityError,
  type ChunkedInfo,
  type SRIString,
} from 'verifyfetch';
import type {
  ModelVerificationManifest,
  PreloadOptions,
  PreloadProgress,
  PreloadResult,
  ModelFileInfo,
} from './types.js';
import { ManifestError, ModelVerificationError } from './types.js';
import {
  loadModelManifest,
  getModelEntry,
  getFileUrl,
  isChunkedFile,
} from './model-manifest.js';

/**
 * Default cache name used by Transformers.js for model files.
 * Transformers.js uses the Cache API with 'transformers-cache' as the cache name.
 */
const TRANSFORMERS_CACHE = 'transformers-cache';

/** Default timeout per request (30 seconds) */
const DEFAULT_TIMEOUT = 30000;

/**
 * Preload and verify a Transformers.js model
 *
 * Downloads all model files, verifies their integrity, and stores them
 * in Cache API. Transformers.js will find these cached files when loading.
 *
 * @param modelId - HuggingFace model ID (e.g., "Xenova/distilbert-base-uncased-finetuned-sst-2-english")
 * @param options - Preload options
 * @returns Preload result with statistics
 *
 * @example
 * ```ts
 * import { preloadVerifiedModel } from '@verifyfetch/transformers';
 *
 * const result = await preloadVerifiedModel(
 *   'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
 *   {
 *     manifestUrl: '/models/vf-hf.manifest.json',
 *     onProgress: ({ file, percent, resumed }) => {
 *       console.log(`${file}: ${percent}%${resumed ? ' (resumed)' : ''}`);
 *     }
 *   }
 * );
 *
 * console.log(`Downloaded ${result.totalFiles} files (${result.totalBytes} bytes)`);
 * ```
 */
export async function preloadVerifiedModel(
  modelId: string,
  options: PreloadOptions
): Promise<PreloadResult> {
  const startTime = Date.now();

  if (!options.manifest && !options.manifestUrl) {
    throw new ManifestError('Either manifest or manifestUrl must be provided');
  }

  // Load manifest
  const manifest = options.manifest ?? await loadModelManifest(
    options.manifestUrl!,
    options.fetchImpl
  );

  // Get model entry
  const modelEntry = getModelEntry(modelId, manifest);
  const files = Object.entries(modelEntry.files);

  // Track progress
  let filesComplete = 0;
  let filesResumed = 0;
  let totalBytes = 0;
  let anyResumed = false;

  // Open cache
  const cacheName = options.cacheName ?? TRANSFORMERS_CACHE;
  const cache = await caches.open(cacheName);

  // Download and verify each file
  for (const [filename, fileInfo] of files) {
    const fileUrl = getFileUrl(modelId, filename, manifest);

    // Check if already in cache
    const cached = await cache.match(fileUrl);
    if (cached) {
      filesComplete++;
      const contentLen = cached.headers?.get?.('content-length');
      const size = fileInfo.size ?? (contentLen ? parseInt(contentLen, 10) : 0);
      totalBytes += size;

      reportProgress(options.onProgress, {
        phase: 'verifying',
        file: filename,
        bytesVerified: size,
        totalBytes: size,
        percent: 100,
        resumed: false,
        filesComplete,
        totalFiles: files.length,
        speed: 0,
      });
      continue;
    }

    // Download and verify
    const result = await downloadAndVerifyFile(
      modelId,
      filename,
      fileUrl,
      fileInfo,
      options,
      (progress) => {
        reportProgress(options.onProgress, {
          ...progress,
          filesComplete,
          totalFiles: files.length,
        });
      }
    );

    // Store in cache (Transformers.js will find it here)
    await cache.put(fileUrl, new Response(result.data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(result.data.byteLength),
      },
    }));

    filesComplete++;
    totalBytes += result.data.byteLength;
    if (result.resumed) {
      filesResumed++;
      anyResumed = true;
    }
  }

  // Report completion
  reportProgress(options.onProgress, {
    phase: 'complete',
    file: '',
    bytesVerified: totalBytes,
    totalBytes,
    percent: 100,
    resumed: anyResumed,
    filesComplete: files.length,
    totalFiles: files.length,
    speed: 0,
  });

  return {
    modelId,
    resumed: anyResumed,
    filesResumed,
    totalFiles: files.length,
    totalBytes,
    duration: Date.now() - startTime,
  };
}

/**
 * Download and verify a single file
 */
async function downloadAndVerifyFile(
  modelId: string,
  filename: string,
  url: string,
  fileInfo: ModelFileInfo,
  options: PreloadOptions,
  onProgress: (progress: Omit<PreloadProgress, 'filesComplete' | 'totalFiles'>) => void
): Promise<{ data: ArrayBuffer; resumed: boolean }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const resumable = options.resumable ?? true;
  const onFail = options.onFail ?? 'block';

  try {
    if (isChunkedFile(fileInfo) && resumable) {
      // Use resumable download for large chunked files
      const result = await verifyFetchResumable(url, {
        chunked: fileInfo.chunked as ChunkedInfo,
        persist: true,
        fetchImpl,
        chunkTimeout: timeout,
        onProgress: (p) => {
          onProgress({
            phase: 'verifying',
            file: filename,
            bytesVerified: p.bytesVerified,
            totalBytes: p.totalBytes,
            percent: p.totalBytes
              ? Math.round((p.bytesVerified / p.totalBytes) * 100)
              : 0,
            resumed: p.resumed,
            speed: p.speed,
            eta: p.eta,
          });
        },
      });

      return { data: result.data, resumed: result.resumed };
    } else {
      // Use simple verified fetch for small files
      onProgress({
        phase: 'verifying',
        file: filename,
        bytesVerified: 0,
        totalBytes: fileInfo.size,
        percent: 0,
        resumed: false,
        speed: 0,
      });

      const response = await verifyFetch(url, {
        sri: fileInfo.sri as SRIString,
        fetchImpl,
      });

      const data = await response.arrayBuffer();

      onProgress({
        phase: 'verifying',
        file: filename,
        bytesVerified: data.byteLength,
        totalBytes: data.byteLength,
        percent: 100,
        resumed: false,
        speed: 0,
      });

      return { data, resumed: false };
    }
  } catch (error) {
    if (onFail === 'warn') {
      console.warn(`[verifyfetch/transformers] Verification failed for ${filename}:`, error);
      // Still need to download - fall back to unverified
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }
      const data = await response.arrayBuffer();
      return { data, resumed: false };
    }

    // Re-throw with better error
    if (error instanceof IntegrityError) {
      throw new ModelVerificationError(
        modelId,
        filename,
        fileInfo.sri as SRIString,
        (error.actualSri ?? 'unknown') as SRIString
      );
    }
    throw error;
  }
}

/**
 * Report progress if callback is provided
 */
function reportProgress(
  callback: PreloadOptions['onProgress'],
  progress: PreloadProgress
): void {
  if (callback) {
    callback(progress);
  }
}

/**
 * Check if a model is already fully cached
 *
 * @param modelId - Model ID to check
 * @param options - Options with manifest
 * @returns true if all model files are in cache
 */
export async function isModelCached(
  modelId: string,
  options: Pick<PreloadOptions, 'manifest' | 'manifestUrl' | 'fetchImpl' | 'cacheName'>
): Promise<boolean> {
  const manifest = options.manifest ?? await loadModelManifest(
    options.manifestUrl!,
    options.fetchImpl
  );

  const modelEntry = getModelEntry(modelId, manifest);
  const cacheName = options.cacheName ?? TRANSFORMERS_CACHE;
  const cache = await caches.open(cacheName);

  for (const filename of Object.keys(modelEntry.files)) {
    const fileUrl = getFileUrl(modelId, filename, manifest);
    const cached = await cache.match(fileUrl);
    if (!cached) {
      return false;
    }
  }

  return true;
}

/**
 * Clear cached model files
 *
 * @param modelId - Model ID to clear (optional - clears all if not provided)
 * @param options - Options with manifest
 */
export async function clearModelCache(
  modelId?: string,
  options?: Pick<PreloadOptions, 'manifest' | 'manifestUrl' | 'fetchImpl' | 'cacheName'>
): Promise<void> {
  const cacheName = options?.cacheName ?? TRANSFORMERS_CACHE;

  if (!modelId) {
    await caches.delete(cacheName);
    return;
  }

  // Clear specific model
  if (!options?.manifest && !options?.manifestUrl) {
    throw new Error('manifest or manifestUrl required to clear specific model');
  }

  const manifest = options.manifest ?? await loadModelManifest(
    options.manifestUrl!,
    options.fetchImpl
  );

  const modelEntry = getModelEntry(modelId, manifest);
  const cache = await caches.open(cacheName);

  for (const filename of Object.keys(modelEntry.files)) {
    const fileUrl = getFileUrl(modelId, filename, manifest);
    await cache.delete(fileUrl);
  }
}

/**
 * Get preload progress for a partially downloaded model
 *
 * @param modelId - Model ID to check
 * @param options - Options with manifest
 * @returns Progress info or null if no progress exists
 */
export async function getPreloadProgress(
  modelId: string,
  options: Pick<PreloadOptions, 'manifest' | 'manifestUrl' | 'fetchImpl' | 'cacheName'>
): Promise<{
  filesComplete: number;
  totalFiles: number;
  bytesComplete: number;
  totalBytes: number;
} | null> {
  const manifest = options.manifest ?? await loadModelManifest(
    options.manifestUrl!,
    options.fetchImpl
  );

  const modelEntry = getModelEntry(modelId, manifest);
  const files = Object.entries(modelEntry.files);
  const cacheName = options.cacheName ?? TRANSFORMERS_CACHE;
  const cache = await caches.open(cacheName);

  let filesComplete = 0;
  let bytesComplete = 0;
  let totalBytes = 0;

  for (const [filename, fileInfo] of files) {
    const size = fileInfo.size ?? 0;
    totalBytes += size;

    const fileUrl = getFileUrl(modelId, filename, manifest);
    const cached = await cache.match(fileUrl);

    if (cached) {
      filesComplete++;
      bytesComplete += size;
    }
  }

  if (filesComplete === 0) {
    return null;
  }

  return {
    filesComplete,
    totalFiles: files.length,
    bytesComplete,
    totalBytes,
  };
}
