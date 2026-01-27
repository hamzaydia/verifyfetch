// Sign Command
//
// Generates SRI hashes for files and creates/updates a manifest.
//
// Usage:
//   npx verifyfetch sign "./public/**/*.wasm" "./public/models/**/*.bin"
//   npx verifyfetch sign ./public/engine.wasm --out ./public/vf.manifest.json
//   npx verifyfetch sign ./public/model.bin --merkle  # Chunked verification

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import { createHash } from 'crypto';
import { readFile, writeFile, stat } from 'fs/promises';
import { resolve, relative, dirname, basename } from 'path';
import type { VFManifest, VFManifestV2, VFArtifact, VFArtifactV2, SRIString, MerkleInfo } from 'verifyfetch';

// Default chunk size for Merkle tree: 1MB
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

interface SignOptions {
  out: string;
  base: string;
  algorithm: 'sha256' | 'sha384' | 'sha512';
  update: boolean;
  merkle: boolean;
  chunkSize: number;
}

export const signCommand = new Command('sign')
  .description('Generate SRI hashes for files and create a manifest')
  .argument('<patterns...>', 'File patterns to sign (glob syntax supported)')
  .option('-o, --out <file>', 'Output manifest file', './vf.manifest.json')
  .option('-b, --base <path>', 'Base path for URLs in manifest', '/')
  .option('-a, --algorithm <alg>', 'Hash algorithm (sha256, sha384, sha512)', 'sha256')
  .option('-u, --update', 'Update existing manifest instead of replacing', false)
  .option('-m, --merkle', 'Generate Merkle tree for chunked verification (v2 manifest)', false)
  .option('--chunk-size <bytes>', 'Chunk size for Merkle tree in bytes', String(DEFAULT_CHUNK_SIZE))
  .action(async (patterns: string[], options: SignOptions) => {
    // Parse chunk size
    options.chunkSize = parseInt(String(options.chunkSize), 10) || DEFAULT_CHUNK_SIZE;
    const spinner = ora('Finding files...').start();

    try {
      // Validate algorithm
      const validAlgorithms = ['sha256', 'sha384', 'sha512'];
      if (!validAlgorithms.includes(options.algorithm)) {
        spinner.fail(chalk.red(`Invalid algorithm: ${options.algorithm}`));
        console.log(chalk.dim(`Valid algorithms: ${validAlgorithms.join(', ')}`));
        process.exit(1);
      }
      // Expand glob patterns
      const files: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(pattern, { nodir: true, absolute: true });
        files.push(...matches);
      }

      // Deduplicate
      const uniqueFiles = [...new Set(files)];

      if (uniqueFiles.length === 0) {
        spinner.fail(chalk.red('No files found matching the patterns'));
        console.log('\n' + chalk.dim('Patterns searched:'));
        patterns.forEach(p => console.log(chalk.dim(`  - ${p}`)));
        console.log('\n' + chalk.dim('Make sure the files exist and patterns are correct.'));
        process.exit(1);
      }

      spinner.text = `Hashing ${uniqueFiles.length} file(s)...`;

      // Load existing manifest if updating
      let manifest: VFManifest | VFManifestV2;
      const outPath = resolve(options.out);
      const useV2 = options.merkle;

      if (options.update) {
        try {
          const existing = await readFile(outPath, 'utf-8');
          manifest = JSON.parse(existing) as VFManifest | VFManifestV2;
          spinner.text = `Updating existing manifest with ${uniqueFiles.length} file(s)...`;
        } catch {
          // Create new if doesn't exist
          manifest = createEmptyManifest(options.base, useV2);
        }
      } else {
        manifest = createEmptyManifest(options.base, useV2);
      }

      // Process each file
      const cwd = process.cwd();
      const results: Array<{ path: string; sri: SRIString; size: number; merkle?: MerkleInfo }> = [];

      for (const filePath of uniqueFiles) {
        const relativePath = relative(cwd, filePath);
        spinner.text = options.merkle
          ? `Generating Merkle tree for ${relativePath}...`
          : `Hashing ${relativePath}...`;

        const content = await readFile(filePath);
        const sri = computeHash(content, options.algorithm);
        const fileStats = await stat(filePath);

        // Compute manifest path
        let manifestPath = '/' + relativePath.replace(/\\/g, '/');
        if (options.base !== '/') {
          // Ensure base starts with /
          const base = options.base.startsWith('/') ? options.base : '/' + options.base;
          // Remove base from path if present
          if (manifestPath.startsWith(base)) {
            manifestPath = manifestPath.slice(base.length);
            if (!manifestPath.startsWith('/')) {
              manifestPath = '/' + manifestPath;
            }
          }
        }

        if (options.merkle) {
          // Generate Merkle tree
          const merkle = generateMerkleTree(content, options.chunkSize, options.algorithm);

          (manifest as VFManifestV2).artifacts[manifestPath] = {
            sri,
            size: fileStats.size,
            merkle,
          };

          results.push({
            path: manifestPath,
            sri,
            size: fileStats.size,
            merkle,
          });
        } else {
          manifest.artifacts[manifestPath] = {
            sri,
          };

          results.push({
            path: manifestPath,
            sri,
            size: fileStats.size,
          });
        }
      }

      // Write manifest
      spinner.text = 'Writing manifest...';
      await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n');

      const modeStr = options.merkle ? ' with Merkle trees' : '';
      spinner.succeed(chalk.green(`Signed ${results.length} file(s)${modeStr}`));

      // Show results
      console.log('\n' + chalk.dim('Generated hashes:'));
      for (const result of results) {
        const sizeStr = formatSize(result.size);
        if (result.merkle) {
          const chunkCount = result.merkle.tree.length;
          const chunkSizeStr = formatSize(result.merkle.chunkSize);
          console.log(
            `  ${chalk.cyan(result.path)} ${chalk.dim(`(${sizeStr})`)}\n` +
            `    ${chalk.dim('SRI:')} ${chalk.dim(result.sri)}\n` +
            `    ${chalk.dim('Merkle:')} ${chalk.yellow(chunkCount + ' chunks')} ${chalk.dim(`(${chunkSizeStr} each)`)}\n` +
            `    ${chalk.dim('Root:')} ${chalk.dim(result.merkle.root)}`
          );
        } else {
          console.log(
            `  ${chalk.cyan(result.path)} ${chalk.dim(`(${sizeStr})`)}\n` +
            `    ${chalk.dim(result.sri)}`
          );
        }
      }

      console.log('\n' + chalk.dim(`Manifest written to: ${relative(cwd, outPath)}`));

      // Show next steps
      console.log('\n' + chalk.bold('Next steps:'));
      console.log(`  1. Commit the manifest: ${chalk.cyan('git add ' + relative(cwd, outPath))}`);
      console.log(`  2. Use in your code:`);

      if (options.merkle) {
        console.log(chalk.dim(`
     import { verifyFetchStream, createVerifyFetcher } from 'verifyfetch';

     // Option 1: Stream with chunk-by-chunk verification
     const { stream, verified } = await verifyFetchStream('${results[0]?.path || '/your-file.bin'}', {
       sri: '${results[0]?.sri || 'sha256-...'}',
       merkle: true
     });

     for await (const chunk of stream) {
       // Each chunk is verified before yielding
       processChunk(chunk);
     }

     // Option 2: Use manifest-aware fetcher
     const vf = await createVerifyFetcher({ manifestUrl: '${relative(cwd, outPath)}' });
     const data = await vf.arrayBuffer('${results[0]?.path || '/your-file.bin'}');
`));
      } else {
        console.log(chalk.dim(`
     import { verifyFetch } from 'verifyfetch';
     const res = await verifyFetch('${results[0]?.path || '/your-file.bin'}', {
       sri: '${results[0]?.sri || 'sha256-...'}'
     });
`));
      }

    } catch (error) {
      spinner.fail(chalk.red('Failed to sign files'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

function createEmptyManifest(base: string, v2: boolean = false): VFManifest | VFManifestV2 {
  if (v2) {
    return {
      version: 2,
      base,
      artifacts: {},
    } as VFManifestV2;
  }
  return {
    version: 1,
    base,
    artifacts: {},
  };
}

function generateMerkleTree(
  content: Buffer,
  chunkSize: number,
  algorithm: string
): MerkleInfo {
  const chunks = splitIntoChunks(content, chunkSize);
  const tree: SRIString[] = [];

  // Hash each chunk
  for (const chunk of chunks) {
    const hash = createHash(algorithm).update(chunk).digest('base64');
    tree.push(`${algorithm}-${hash}` as SRIString);
  }

  // Compute Merkle root (simple concatenation + hash)
  const concatenated = tree.join('');
  const rootHash = createHash(algorithm).update(concatenated).digest('base64');
  const root = `${algorithm}-${rootHash}` as SRIString;

  return {
    root,
    chunkSize,
    tree,
  };
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
