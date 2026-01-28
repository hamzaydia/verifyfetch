/**
 * @verifyfetch/webllm - Verified, resumable model loading for WebLLM
 *
 * Adds integrity verification and resumable downloads to WebLLM model loading.
 *
 * @packageDocumentation
 *
 * @example Using VerifiedMLCEngine (drop-in replacement)
 * ```ts
 * import { VerifiedMLCEngine } from '@verifyfetch/webllm';
 *
 * const engine = new VerifiedMLCEngine({
 *   verification: {
 *     manifestUrl: '/models/vf.manifest.json'
 *   },
 *   initProgressCallback: (report) => {
 *     console.log(report.text);
 *   }
 * });
 *
 * await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');
 *
 * const response = await engine.chat.completions.create({
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 *
 * @example Using preloader standalone
 * ```ts
 * import { preloadVerifiedModel } from '@verifyfetch/webllm';
 * import { MLCEngine } from '@mlc-ai/web-llm';
 *
 * // Pre-download with verification
 * await preloadVerifiedModel('Phi-3-mini-4k-instruct-q4f16_1-MLC', {
 *   manifestUrl: '/models/vf.manifest.json',
 *   onProgress: ({ file, percent }) => console.log(`${file}: ${percent}%`)
 * });
 *
 * // Now use standard WebLLM - model is cached
 * const engine = new MLCEngine();
 * await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');
 * ```
 */

// Main engine
export {
  VerifiedMLCEngine,
  createVerifiedEngine,
  type VerifiedMLCEngineConfig,
  type InitProgressReport,
  type InitProgressCallback,
  type ChatMessage,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
} from './verified-engine.js';

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
} from './types.js';

// Errors
export {
  ModelVerificationError,
  ManifestError,
  ModelNotFoundError,
} from './types.js';
