/**
 * @verifyfetch/transformers - Verified, resumable model loading for Transformers.js
 *
 * Adds integrity verification and resumable downloads to Transformers.js model loading.
 *
 * @packageDocumentation
 *
 * @example Using verifiedPipeline (recommended)
 * ```ts
 * import { verifiedPipeline } from '@verifyfetch/transformers';
 *
 * const classifier = await verifiedPipeline(
 *   'sentiment-analysis',
 *   'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
 *   {
 *     manifestUrl: '/models/vf-hf.manifest.json',
 *     onProgress: (p) => console.log(`${p.file}: ${p.percent}%`)
 *   }
 * );
 *
 * const result = await classifier('I love this!');
 * ```
 *
 * @example Using global verification
 * ```ts
 * import { enableVerification } from '@verifyfetch/transformers';
 * import { pipeline } from '@huggingface/transformers';
 *
 * // Enable once — all pipelines are verified automatically
 * await enableVerification({
 *   manifestUrl: '/models/vf-hf.manifest.json'
 * });
 *
 * const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
 * ```
 *
 * @example Using preloader standalone
 * ```ts
 * import { preloadVerifiedModel } from '@verifyfetch/transformers';
 * import { pipeline } from '@huggingface/transformers';
 *
 * // Pre-download with verification
 * await preloadVerifiedModel('Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
 *   manifestUrl: '/models/vf-hf.manifest.json',
 *   onProgress: ({ file, percent }) => console.log(`${file}: ${percent}%`)
 * });
 *
 * // Now use standard Transformers.js — model is cached
 * const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
 * ```
 */

// Verified pipeline
export { verifiedPipeline } from './verified-pipeline.js';

// Global interceptor
export {
  enableVerification,
  disableVerification,
  isVerificationEnabled,
  createVerifiedFetch,
} from './hub-interceptor.js';

// Preloader
export {
  preloadVerifiedModel,
  isModelCached,
  clearModelCache,
  getPreloadProgress,
} from './preloader.js';

// Manifest utilities
export {
  loadModelManifest,
  validateManifest,
  getModelEntry,
  getModelFiles,
  getFileUrl,
  isChunkedFile,
  getAvailableModels,
  createEmptyManifest,
  addModelToManifest,
  lookupSriByUrl,
} from './model-manifest.js';

// Types
export type {
  ModelVerificationManifest,
  ModelEntry,
  ModelFileInfo,
  VerificationConfig,
  PreloadOptions,
  PreloadProgress,
  PreloadResult,
  VerifiedPipelineOptions,
} from './types.js';

// Errors
export {
  ModelVerificationError,
  ManifestError,
  ModelNotFoundError,
} from './types.js';
