// Hash Model Command
//
// Generates a verification manifest for a Hugging Face model.
// Fetches file list from HF API, downloads and hashes each file.
//
// Usage:
//   npx verifyfetch hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english
//   npx verifyfetch hash-model onnx-community/Qwen2.5-Coder-0.5B-Instruct --chunked
//   npx verifyfetch hash-model Xenova/all-MiniLM-L6-v2 --out ./manifests/model.json

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createHash } from 'crypto';
import { writeFile, readFile } from 'fs/promises';
import { resolve, relative } from 'path';
import type { SRIString, ChunkedInfo } from 'verifyfetch';

// Default chunk size: 1MB
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

// Default large file threshold for auto-chunking: 50MB
const AUTO_CHUNK_THRESHOLD = 50 * 1024 * 1024;

/** HF API file entry */
interface HFFileEntry {
  type: 'file' | 'directory';
  path: string;
  size: number;
  oid?: string;
  lfs?: {
    oid: string;
    size: number;
  };
}

/** Model file info for manifest */
interface ModelFileInfo {
  sri: SRIString;
  size?: number;
  chunked?: ChunkedInfo;
}

/** Model manifest format */
interface ModelManifest {
  version: 2;
  models: Record<string, {
    baseUrl: string;
    files: Record<string, ModelFileInfo>;
  }>;
}

interface HashModelOptions {
  out: string;
  algorithm: 'sha256' | 'sha384' | 'sha512';
  chunked: boolean;
  chunkSize: number;
  revision: string;
  include: string;
  update: boolean;
}

/** File extensions relevant to Transformers.js / ML models */
const ML_FILE_EXTENSIONS = [
  '.onnx',
  '.json',
  '.bin',
  '.safetensors',
  '.wasm',
  '.txt',         // vocab.txt, merges.txt
  '.model',       // sentencepiece
];

export const hashModelCommand = new Command('hash-model')
  .description('Generate a verification manifest for a Hugging Face model')
  .argument('<model-id>', 'HuggingFace model ID (e.g., Xenova/distilbert-base-uncased-finetuned-sst-2-english)')
  .option('-o, --out <file>', 'Output manifest file', './models.vf.manifest.json')
  .option('-a, --algorithm <alg>', 'Hash algorithm (sha256, sha384, sha512)', 'sha256')
  .option('-c, --chunked', 'Generate per-chunk hashes for large files', false)
  .option('--chunk-size <bytes>', 'Chunk size in bytes (default: 1MB)', String(DEFAULT_CHUNK_SIZE))
  .option('-r, --revision <ref>', 'Git revision/branch (default: main)', 'main')
  .option('-i, --include <pattern>', 'Only include files matching pattern (comma-separated extensions)', '')
  .option('-u, --update', 'Update existing manifest instead of replacing', false)
  .action(async (modelId: string, options: HashModelOptions) => {
    options.chunkSize = parseInt(String(options.chunkSize), 10) || DEFAULT_CHUNK_SIZE;
    if (options.chunkSize <= 0) options.chunkSize = DEFAULT_CHUNK_SIZE;
    const spinner = ora(`Fetching file list for ${modelId}...`).start();

    try {
      // Validate algorithm
      const validAlgorithms = ['sha256', 'sha384', 'sha512'];
      if (!validAlgorithms.includes(options.algorithm)) {
        spinner.fail(chalk.red(`Invalid algorithm: ${options.algorithm}`));
        process.exit(1);
      }

      // Fetch file list from HF API
      const files = await fetchModelFiles(modelId, options.revision);

      if (files.length === 0) {
        spinner.fail(chalk.red(`No files found for model ${modelId}`));
        process.exit(1);
      }

      // Filter to ML-relevant files
      const includeExts = options.include
        ? options.include.split(',').map(e => e.trim().startsWith('.') ? e.trim() : '.' + e.trim())
        : ML_FILE_EXTENSIONS;

      const relevantFiles = files.filter(f =>
        f.type === 'file' && includeExts.some(ext => f.path.endsWith(ext))
      );

      if (relevantFiles.length === 0) {
        spinner.fail(chalk.red(`No relevant files found for model ${modelId}`));
        console.log(chalk.dim(`Files found: ${files.map(f => f.path).join(', ')}`));
        console.log(chalk.dim(`Include extensions: ${includeExts.join(', ')}`));
        process.exit(1);
      }

      spinner.text = `Hashing ${relevantFiles.length} file(s) from ${modelId}...`;

      // Load or create manifest
      const outPath = resolve(options.out);
      let manifest: ModelManifest;

      if (options.update) {
        try {
          const existing = await readFile(outPath, 'utf-8');
          manifest = JSON.parse(existing) as ModelManifest;
        } catch {
          manifest = { version: 2, models: {} };
        }
      } else {
        manifest = { version: 2, models: {} };
      }

      // Base URL for this model
      const baseUrl = `https://huggingface.co/${modelId}/resolve/${options.revision}/`;

      // Initialize model entry
      const modelFiles: Record<string, ModelFileInfo> = {};

      // Download and hash each file
      let processed = 0;
      for (const file of relevantFiles) {
        processed++;
        const sizeStr = formatSize(file.size);
        spinner.text = `[${processed}/${relevantFiles.length}] Hashing ${file.path} (${sizeStr})...`;

        const fileUrl = `${baseUrl}${file.path}`;
        const response = await fetch(fileUrl);

        if (!response.ok) {
          spinner.warn(chalk.yellow(`Skipping ${file.path}: HTTP ${response.status}`));
          spinner.start(`Continuing...`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Compute SRI hash
        const sri = computeHash(buffer, options.algorithm);

        const fileInfo: ModelFileInfo = { sri };

        // Add size
        if (file.size > 0) {
          fileInfo.size = file.size;
        }

        // Generate chunked hashes for large files
        if (options.chunked && file.size >= AUTO_CHUNK_THRESHOLD) {
          spinner.text = `[${processed}/${relevantFiles.length}] Generating chunk hashes for ${file.path}...`;
          fileInfo.chunked = generateChunkedHashes(buffer, options.chunkSize, options.algorithm);
        }

        modelFiles[file.path] = fileInfo;
      }

      // Add to manifest
      manifest.models[modelId] = {
        baseUrl,
        files: modelFiles,
      };

      // Write manifest
      spinner.text = 'Writing manifest...';
      await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n');

      const totalSize = relevantFiles.reduce((sum, f) => sum + f.size, 0);
      spinner.succeed(
        chalk.green(`Hashed ${Object.keys(modelFiles).length} files from ${modelId} (${formatSize(totalSize)})`)
      );

      // Show results
      console.log('\n' + chalk.dim('Generated hashes:'));
      for (const [path, info] of Object.entries(modelFiles)) {
        const sizeStr = info.size ? ` (${formatSize(info.size)})` : '';
        if (info.chunked) {
          console.log(
            `  ${chalk.cyan(path)}${chalk.dim(sizeStr)}\n` +
            `    ${chalk.dim('SRI:')} ${chalk.dim(info.sri)}\n` +
            `    ${chalk.dim('Chunks:')} ${chalk.yellow(info.chunked.hashes.length + ' chunks')}`
          );
        } else {
          console.log(
            `  ${chalk.cyan(path)}${chalk.dim(sizeStr)}\n` +
            `    ${chalk.dim(info.sri)}`
          );
        }
      }

      console.log('\n' + chalk.dim(`Manifest written to: ${relative(process.cwd(), outPath)}`));

      // Show next steps
      console.log('\n' + chalk.bold('Next steps:'));
      console.log(`  1. Commit the manifest: ${chalk.cyan(`git add ${relative(process.cwd(), outPath)}`)}`);
      console.log(`  2. Use in your code:\n`);
      console.log(chalk.dim(`     import { verifiedPipeline } from '@verifyfetch/transformers';`));
      console.log(chalk.dim(`     `));
      console.log(chalk.dim(`     const pipe = await verifiedPipeline('your-task', '${modelId}', {`));
      console.log(chalk.dim(`       manifestUrl: '/${relative(process.cwd(), outPath)}'`));
      console.log(chalk.dim(`     });`));
      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Failed to hash model'));
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('Not Found')) {
          console.error(chalk.red(`Model "${modelId}" not found on Hugging Face Hub.`));
          console.error(chalk.dim(`Make sure the model ID is correct (e.g., Xenova/distilbert-base-uncased-finetuned-sst-2-english)`));
        } else {
          console.error(chalk.red(error.message));
        }
      }
      process.exit(1);
    }
  });

/**
 * Fetch file list from Hugging Face API
 */
async function fetchModelFiles(modelId: string, revision: string): Promise<HFFileEntry[]> {
  const allFiles: HFFileEntry[] = [];

  // Recursively fetch files (HF API returns directory contents per path)
  async function fetchDir(path: string): Promise<void> {
    const apiUrl = path
      ? `https://huggingface.co/api/models/${modelId}/tree/${revision}/${path}`
      : `https://huggingface.co/api/models/${modelId}/tree/${revision}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Model not found: ${modelId} (404)`);
      }
      throw new Error(`HF API error: ${response.status} ${response.statusText}`);
    }

    const entries = await response.json() as HFFileEntry[];

    for (const entry of entries) {
      if (entry.type === 'file') {
        allFiles.push(entry);
      } else if (entry.type === 'directory') {
        // Recurse into subdirectories (e.g., onnx/)
        await fetchDir(entry.path);
      }
    }
  }

  await fetchDir('');
  return allFiles;
}

function generateChunkedHashes(
  content: Buffer,
  chunkSize: number,
  algorithm: string
): ChunkedInfo {
  const chunks = splitIntoChunks(content, chunkSize);
  const hashes: SRIString[] = [];

  for (const chunk of chunks) {
    const hash = createHash(algorithm).update(chunk).digest('base64');
    hashes.push(`${algorithm}-${hash}` as SRIString);
  }

  // Match core library behavior: single chunk -> root IS the chunk hash
  let root: SRIString;
  if (hashes.length === 1) {
    root = hashes[0];
  } else {
    const concatenated = hashes.join('');
    const rootHash = createHash(algorithm).update(concatenated).digest('base64');
    root = `${algorithm}-${rootHash}` as SRIString;
  }

  return { root, chunkSize, hashes };
}

function splitIntoChunks(content: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < content.length) {
    const end = Math.min(offset + chunkSize, content.length);
    chunks.push(content.subarray(offset, end));
    offset = end;
  }

  return chunks;
}

function computeHash(content: Buffer, algorithm: string): SRIString {
  const hash = createHash(algorithm).update(content).digest('base64');
  return `${algorithm}-${hash}` as SRIString;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
