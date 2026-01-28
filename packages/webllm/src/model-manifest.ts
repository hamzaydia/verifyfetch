/**
 * Model Manifest Handling
 *
 * Load, validate, and query verification manifests for WebLLM models.
 */

import type {
  ModelVerificationManifest,
  ModelEntry,
  ModelFileInfo,
} from './types.js';
import { ManifestError, ModelNotFoundError } from './types.js';

/**
 * Load a verification manifest from a URL
 *
 * @param url - URL to fetch the manifest from
 * @param fetchImpl - Custom fetch implementation (optional)
 * @returns Parsed and validated manifest
 *
 * @example
 * ```ts
 * const manifest = await loadModelManifest('/models/vf.manifest.json');
 * ```
 */
export async function loadModelManifest(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<ModelVerificationManifest> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new ManifestError(
      `Failed to fetch manifest from ${url}: ${response.status} ${response.statusText}`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ManifestError(`Failed to parse manifest as JSON from ${url}`);
  }

  return validateManifest(data);
}

/**
 * Validate that an object is a valid ModelVerificationManifest
 *
 * @param data - Object to validate
 * @returns Validated manifest
 * @throws ManifestError if validation fails
 */
export function validateManifest(data: unknown): ModelVerificationManifest {
  if (!data || typeof data !== 'object') {
    throw new ManifestError('Manifest must be an object');
  }

  const obj = data as Record<string, unknown>;

  // Check version
  if (obj.version !== 1 && obj.version !== 2) {
    throw new ManifestError(
      `Manifest version must be 1 or 2, got: ${obj.version}`
    );
  }

  // Check models
  if (!obj.models || typeof obj.models !== 'object') {
    throw new ManifestError('Manifest must have a "models" object');
  }

  const models = obj.models as Record<string, unknown>;

  // Validate each model entry
  for (const [modelId, entry] of Object.entries(models)) {
    validateModelEntry(modelId, entry);
  }

  return data as ModelVerificationManifest;
}

/**
 * Validate a single model entry
 */
function validateModelEntry(modelId: string, entry: unknown): void {
  if (!entry || typeof entry !== 'object') {
    throw new ManifestError(`Model "${modelId}" must be an object`);
  }

  const obj = entry as Record<string, unknown>;

  // Check baseUrl
  if (typeof obj.baseUrl !== 'string' || !obj.baseUrl) {
    throw new ManifestError(`Model "${modelId}" must have a "baseUrl" string`);
  }

  // Check files
  if (!obj.files || typeof obj.files !== 'object') {
    throw new ManifestError(`Model "${modelId}" must have a "files" object`);
  }

  const files = obj.files as Record<string, unknown>;

  // Validate each file
  for (const [filename, fileInfo] of Object.entries(files)) {
    validateFileInfo(modelId, filename, fileInfo);
  }
}

/**
 * Validate a single file info entry
 */
function validateFileInfo(
  modelId: string,
  filename: string,
  fileInfo: unknown
): void {
  if (!fileInfo || typeof fileInfo !== 'object') {
    throw new ManifestError(
      `File "${filename}" in model "${modelId}" must be an object`
    );
  }

  const obj = fileInfo as Record<string, unknown>;

  // Check sri
  if (typeof obj.sri !== 'string' || !obj.sri) {
    throw new ManifestError(
      `File "${filename}" in model "${modelId}" must have an "sri" string`
    );
  }

  // Validate sri format
  if (!isValidSRI(obj.sri)) {
    throw new ManifestError(
      `File "${filename}" in model "${modelId}" has invalid SRI format: ${obj.sri}`
    );
  }

  // If chunked, validate chunked config
  if (obj.chunked !== undefined) {
    validateChunkedConfig(modelId, filename, obj.chunked);
  }
}

/**
 * Validate chunked config
 */
function validateChunkedConfig(
  modelId: string,
  filename: string,
  chunked: unknown
): void {
  if (!chunked || typeof chunked !== 'object') {
    throw new ManifestError(
      `Chunked config for "${filename}" in model "${modelId}" must be an object`
    );
  }

  const obj = chunked as Record<string, unknown>;

  // Check root
  if (typeof obj.root !== 'string' || !isValidSRI(obj.root)) {
    throw new ManifestError(
      `Chunked config for "${filename}" in model "${modelId}" must have a valid "root" SRI`
    );
  }

  // Check chunkSize
  if (typeof obj.chunkSize !== 'number' || obj.chunkSize <= 0) {
    throw new ManifestError(
      `Chunked config for "${filename}" in model "${modelId}" must have a positive "chunkSize"`
    );
  }

  // Check hashes
  if (!Array.isArray(obj.hashes) || obj.hashes.length === 0) {
    throw new ManifestError(
      `Chunked config for "${filename}" in model "${modelId}" must have a non-empty "hashes" array`
    );
  }

  // Validate each hash
  for (let i = 0; i < obj.hashes.length; i++) {
    if (typeof obj.hashes[i] !== 'string' || !isValidSRI(obj.hashes[i])) {
      throw new ManifestError(
        `Chunked hash at index ${i} for "${filename}" in model "${modelId}" is invalid`
      );
    }
  }
}

/**
 * Check if a string is a valid SRI hash
 */
function isValidSRI(sri: string): boolean {
  return /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/.test(sri);
}

/**
 * Get model entry from manifest
 *
 * @param modelId - Model ID to look up
 * @param manifest - Verification manifest
 * @returns Model entry
 * @throws ModelNotFoundError if model is not in manifest
 */
export function getModelEntry(
  modelId: string,
  manifest: ModelVerificationManifest
): ModelEntry {
  const entry = manifest.models[modelId];

  if (!entry) {
    throw new ModelNotFoundError(modelId, Object.keys(manifest.models));
  }

  return entry;
}

/**
 * Get all files for a model
 *
 * @param modelId - Model ID
 * @param manifest - Verification manifest
 * @returns Array of [filename, fileInfo] pairs
 */
export function getModelFiles(
  modelId: string,
  manifest: ModelVerificationManifest
): Array<[string, ModelFileInfo]> {
  const entry = getModelEntry(modelId, manifest);
  return Object.entries(entry.files);
}

/**
 * Get the full URL for a model file
 *
 * @param modelId - Model ID
 * @param filename - Filename within the model
 * @param manifest - Verification manifest
 * @returns Full URL to the file
 */
export function getFileUrl(
  modelId: string,
  filename: string,
  manifest: ModelVerificationManifest
): string {
  const entry = getModelEntry(modelId, manifest);
  const baseUrl = entry.baseUrl.endsWith('/')
    ? entry.baseUrl
    : entry.baseUrl + '/';
  return baseUrl + filename;
}

/**
 * Check if a file has chunked verification config
 */
export function isChunkedFile(fileInfo: ModelFileInfo): boolean {
  return fileInfo.chunked !== undefined && fileInfo.chunked.hashes.length > 0;
}

/**
 * Get list of model IDs in manifest
 */
export function getAvailableModels(
  manifest: ModelVerificationManifest
): string[] {
  return Object.keys(manifest.models);
}

/**
 * Create an empty manifest
 */
export function createEmptyManifest(): ModelVerificationManifest {
  return {
    version: 2,
    models: {},
  };
}

/**
 * Add a model to a manifest (immutable - returns new manifest)
 */
export function addModelToManifest(
  manifest: ModelVerificationManifest,
  modelId: string,
  entry: ModelEntry
): ModelVerificationManifest {
  return {
    ...manifest,
    models: {
      ...manifest.models,
      [modelId]: entry,
    },
  };
}
