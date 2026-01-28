/**
 * Verified MLC Engine
 *
 * A wrapper around WebLLM's MLCEngine that adds integrity verification
 * and resumable downloads for model loading.
 */

import type {
  VerificationConfig,
  ModelVerificationManifest,
  PreloadProgress,
} from './types.js';
import { preloadVerifiedModel } from './preloader.js';
import { loadModelManifest, getAvailableModels } from './model-manifest.js';

/**
 * Progress report from WebLLM (matches their interface)
 */
export interface InitProgressReport {
  progress: number;
  timeElapsed: number;
  text: string;
}

/**
 * Progress callback type (matches WebLLM)
 */
export type InitProgressCallback = (report: InitProgressReport) => void;

/**
 * Configuration for VerifiedMLCEngine
 */
export interface VerifiedMLCEngineConfig {
  /** Verification configuration */
  verification: VerificationConfig;

  /** Progress callback (receives both verification and loading progress) */
  initProgressCallback?: InitProgressCallback;

  /** App configuration (passed to underlying MLCEngine) */
  appConfig?: unknown;
}

/**
 * Chat completion message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * VerifiedMLCEngine - Drop-in replacement for MLCEngine with integrity verification
 *
 * Pre-downloads and verifies all model files before loading.
 * Supports resumable downloads for large model shards.
 *
 * @example
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
 */
export class VerifiedMLCEngine {
  private config: VerifiedMLCEngineConfig;
  private manifest: ModelVerificationManifest | null = null;
  private mlcEngine: unknown = null;
  private currentModel: string | null = null;

  /** Chat completions API (OpenAI-compatible) */
  public chat: {
    completions: {
      create: (request: ChatCompletionRequest) => Promise<ChatCompletionResponse>;
    };
  };

  constructor(config: VerifiedMLCEngineConfig) {
    this.config = config;

    // Set up chat API that delegates to underlying engine
    this.chat = {
      completions: {
        create: async (request: ChatCompletionRequest) => {
          if (!this.mlcEngine) {
            throw new Error('Engine not loaded. Call reload() first.');
          }
          // @ts-expect-error - accessing WebLLM engine internals
          return this.mlcEngine.chat.completions.create(request);
        },
      },
    };
  }

  /**
   * Load a model with verification
   *
   * @param modelId - Model ID to load (e.g., "Phi-3-mini-4k-instruct-q4f16_1-MLC")
   */
  async reload(modelId: string): Promise<void> {
    const startTime = Date.now();

    // Load manifest if not already loaded
    if (!this.manifest) {
      this.manifest = await this.loadManifest();
    }

    // Check if model is in our manifest
    const availableModels = getAvailableModels(this.manifest);
    const hasVerification = availableModels.includes(modelId);

    if (!hasVerification) {
      const onFail = this.config.verification.onFail ?? 'block';
      if (onFail === 'block') {
        throw new Error(
          `Model "${modelId}" not found in verification manifest.\n` +
          `Available models: ${availableModels.join(', ') || '(none)'}\n\n` +
          `Either add this model to your manifest or set onFail: 'warn' to skip verification.`
        );
      } else {
        console.warn(
          `[verifyfetch/webllm] Model "${modelId}" not in manifest, skipping verification`
        );
      }
    }

    // Phase 1: Verify and download
    if (hasVerification) {
      this.reportProgress({
        progress: 0,
        timeElapsed: 0,
        text: `Verifying ${modelId}...`,
      });

      await preloadVerifiedModel(modelId, {
        manifest: this.manifest,
        resumable: this.config.verification.resumable ?? true,
        onFail: this.config.verification.onFail ?? 'block',
        cacheName: this.config.verification.cacheName,
        onProgress: (p) => this.handleVerificationProgress(modelId, p, startTime),
      });
    }

    // Phase 2: Load with WebLLM
    this.reportProgress({
      progress: 0.5,
      timeElapsed: (Date.now() - startTime) / 1000,
      text: `Loading ${modelId}...`,
    });

    // Dynamically import WebLLM
    const webllm = await this.importWebLLM();
    if (!webllm) {
      throw new Error(
        '@mlc-ai/web-llm is required but not installed.\n' +
        'Install it with: npm install @mlc-ai/web-llm'
      );
    }

    // Create or reuse engine
    if (!this.mlcEngine) {
      this.mlcEngine = new webllm.MLCEngine({
        appConfig: this.config.appConfig,
        initProgressCallback: (report: InitProgressReport) => {
          // Adjust progress to account for verification phase
          const adjustedProgress = 0.5 + report.progress * 0.5;
          this.reportProgress({
            progress: adjustedProgress,
            timeElapsed: report.timeElapsed + (Date.now() - startTime) / 1000,
            text: report.text,
          });
        },
      });
    }

    // Load the model
    // @ts-expect-error - accessing WebLLM engine internals
    await this.mlcEngine.reload(modelId);
    this.currentModel = modelId;

    this.reportProgress({
      progress: 1,
      timeElapsed: (Date.now() - startTime) / 1000,
      text: `${modelId} ready`,
    });
  }

  /**
   * Unload the current model
   */
  async unload(): Promise<void> {
    if (this.mlcEngine) {
      // @ts-expect-error - accessing WebLLM engine internals
      await this.mlcEngine.unload();
      this.currentModel = null;
    }
  }

  /**
   * Get the currently loaded model ID
   */
  getCurrentModel(): string | null {
    return this.currentModel;
  }

  /**
   * Generate text completion
   */
  async generate(prompt: string, options?: { maxTokens?: number }): Promise<string> {
    if (!this.mlcEngine) {
      throw new Error('Engine not loaded. Call reload() first.');
    }
    // @ts-expect-error - accessing WebLLM engine internals
    return this.mlcEngine.generate(prompt, options);
  }

  /**
   * Reset the chat state
   */
  async resetChat(): Promise<void> {
    if (this.mlcEngine) {
      // @ts-expect-error - accessing WebLLM engine internals
      await this.mlcEngine.resetChat();
    }
  }

  /**
   * Get runtime statistics
   */
  async getRuntimeStats(): Promise<string> {
    if (!this.mlcEngine) {
      return 'Engine not loaded';
    }
    // @ts-expect-error - accessing WebLLM engine internals
    return this.mlcEngine.runtimeStatsText();
  }

  // ============ Private Methods ============

  private async loadManifest(): Promise<ModelVerificationManifest> {
    const { manifestUrl, manifest } = this.config.verification;

    if (manifest) {
      return manifest;
    }

    if (manifestUrl) {
      return loadModelManifest(manifestUrl);
    }

    throw new Error(
      'Verification requires either manifestUrl or manifest in config'
    );
  }

  private handleVerificationProgress(
    modelId: string,
    progress: PreloadProgress,
    startTime: number
  ): void {
    // Map verification progress to 0-50% of total progress
    const verifyProgress = (progress.filesComplete / progress.totalFiles) * 0.5;

    let text: string;
    if (progress.phase === 'complete') {
      text = `Verified ${modelId}`;
    } else if (progress.resumed) {
      text = `Verifying ${modelId}: ${progress.file} (${progress.percent}%, resumed)`;
    } else {
      text = `Verifying ${modelId}: ${progress.file} (${progress.percent}%)`;
    }

    this.reportProgress({
      progress: verifyProgress,
      timeElapsed: (Date.now() - startTime) / 1000,
      text,
    });
  }

  private reportProgress(report: InitProgressReport): void {
    if (this.config.initProgressCallback) {
      this.config.initProgressCallback(report);
    }
  }

  private async importWebLLM(): Promise<{ MLCEngine: new (config: unknown) => unknown } | null> {
    try {
      // Dynamic import to avoid requiring WebLLM at bundle time
      const module = await import('@mlc-ai/web-llm');
      return module as { MLCEngine: new (config: unknown) => unknown };
    } catch {
      return null;
    }
  }
}

/**
 * Create a verified engine with default configuration
 *
 * @param manifestUrl - URL to the verification manifest
 * @param onProgress - Optional progress callback
 * @returns Configured VerifiedMLCEngine
 *
 * @example
 * ```ts
 * const engine = createVerifiedEngine('/models/vf.manifest.json', (report) => {
 *   console.log(report.text);
 * });
 *
 * await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');
 * ```
 */
export function createVerifiedEngine(
  manifestUrl: string,
  onProgress?: InitProgressCallback
): VerifiedMLCEngine {
  return new VerifiedMLCEngine({
    verification: {
      manifestUrl,
    },
    initProgressCallback: onProgress,
  });
}
