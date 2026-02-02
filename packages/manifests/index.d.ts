/**
 * @verifyfetch/manifests - Pre-computed integrity manifests for popular AI models
 */

export declare const availableModels: {
  transformers: string[];
  webllm: string[];
};

export declare function getManifestPath(runtime: 'transformers' | 'webllm', modelId: string): string;
