/**
 * Verified Pipeline
 *
 * A wrapper around Transformers.js pipeline() that adds integrity
 * verification for all model file downloads.
 */

import type {
  ModelVerificationManifest,
  VerifiedPipelineOptions,
} from './types.js';
import { ManifestError } from './types.js';
import { loadModelManifest } from './model-manifest.js';
import { createVerifiedFetch } from './hub-interceptor.js';
import { preloadVerifiedModel } from './preloader.js';

/**
 * Create a Transformers.js pipeline with verified model downloads.
 *
 * Downloads and verifies all model files before creating the pipeline.
 * This is the recommended way to use Transformers.js with verification —
 * it verifies once, caches the result, and creates the pipeline.
 *
 * @param task - The pipeline task (e.g., 'sentiment-analysis', 'text-generation')
 * @param model - The model ID on Hugging Face Hub (e.g., 'Xenova/distilbert-base-uncased-finetuned-sst-2-english')
 * @param options - Verification options including manifest URL/object
 * @returns The Transformers.js pipeline instance
 *
 * @example
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
 * console.log(result); // [{ label: 'POSITIVE', score: 0.99 }]
 * ```
 */
export async function verifiedPipeline(
  task: string,
  model: string,
  options: VerifiedPipelineOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!options.manifest && !options.manifestUrl) {
    throw new ManifestError('Either manifest or manifestUrl must be provided');
  }

  // Load manifest
  const manifest: ModelVerificationManifest = options.manifest ?? await loadModelManifest(
    options.manifestUrl!,
    options.fetchImpl
  );

  const onFail = options.onFail ?? 'block';

  // Check if model is in manifest
  const hasVerification = model in manifest.models;

  if (!hasVerification && onFail === 'block') {
    const available = Object.keys(manifest.models);
    throw new Error(
      `Model "${model}" not found in verification manifest.\n` +
      `Available models: ${available.slice(0, 10).join(', ') || '(none)'}` +
      (available.length > 10 ? ` ... and ${available.length - 10} more` : '') + '\n\n' +
      `Either add this model to your manifest or set onFail: 'warn' to skip verification.`
    );
  }

  // Phase 1: Pre-download and verify model files if in manifest
  if (hasVerification) {
    await preloadVerifiedModel(model, {
      manifest,
      onProgress: options.onProgress,
      onFail,
      resumable: options.resumable,
      cacheName: options.cacheName,
      fetchImpl: options.fetchImpl,
      timeout: options.timeout,
    });
  } else if (onFail === 'warn') {
    console.warn(
      `[verifyfetch/transformers] Model "${model}" not in manifest, skipping verification`
    );
  }

  // Phase 2: Create the pipeline with Transformers.js
  // Files are already cached — Transformers.js will find them
  const transformers = await importTransformers();
  if (!transformers) {
    throw new Error(
      '@huggingface/transformers is required but not installed.\n' +
      'Install it with: npm install @huggingface/transformers'
    );
  }

  // Create a verified fetch for any files not pre-downloaded
  const verifiedFetch = createVerifiedFetch(
    manifest,
    onFail,
    options.fetchImpl ?? globalThis.fetch
  );

  // Build pipeline options
  const pipelineOptions: Record<string, unknown> = {};
  if (options.quantized !== undefined) {
    pipelineOptions.quantized = options.quantized;
  }
  if (options.revision !== undefined) {
    pipelineOptions.revision = options.revision;
  }

  // Use env.fetch temporarily for this pipeline creation
  // Note: Transformers.js v3+ uses env.fetch (not env.customFetch)
  const prevFetch = transformers.env?.fetch;
  if (transformers.env) {
    transformers.env.fetch = verifiedFetch;
  }

  try {
    const pipe = await transformers.pipeline(task, model, pipelineOptions);
    return pipe;
  } finally {
    // Restore previous fetch
    if (transformers.env) {
      transformers.env.fetch = prevFetch;
    }
  }
}

/**
 * Import Transformers.js dynamically
 */
async function importTransformers(): Promise<{
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
  env?: {
    fetch: typeof fetch | undefined;
    [key: string]: unknown;
  };
} | null> {
  try {
    const module = await import('@huggingface/transformers');
    return module as unknown as {
      pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
      env?: {
        fetch: typeof fetch | undefined;
        [key: string]: unknown;
      };
    };
  } catch {
    return null;
  }
}
