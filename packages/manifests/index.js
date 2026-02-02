/**
 * @verifyfetch/manifests - Pre-computed integrity manifests for popular AI models
 *
 * Import manifests directly:
 *   import manifest from '@verifyfetch/manifests/transformers/Xenova--distilbert-base-uncased-finetuned-sst-2-english.json';
 *
 * Or use the helper to list available manifests:
 *   import { availableModels } from '@verifyfetch/manifests';
 */

export const availableModels = {
  transformers: [
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    'Xenova/all-MiniLM-L6-v2',
  ],
  webllm: [
    'Phi-3-mini-4k-instruct-q4f16_1-MLC',
  ],
};

/**
 * Get the import path for a model manifest
 * @param {string} runtime - 'transformers' or 'webllm'
 * @param {string} modelId - Model ID (e.g., 'Xenova/distilbert-base-uncased-finetuned-sst-2-english')
 * @returns {string} Import path
 */
export function getManifestPath(runtime, modelId) {
  const safeName = modelId.replace(/\//g, '--');
  return `@verifyfetch/manifests/${runtime}/${safeName}.json`;
}
