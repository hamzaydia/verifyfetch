// Sign Command
//
// Generates SRI hashes for files and creates/updates a manifest.
//
// Usage:
//   npx verifyfetch sign "./public/**/*.wasm" "./public/models/**/*.bin"
//   npx verifyfetch sign ./public/engine.wasm --out ./public/vf.manifest.json

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import { createHash } from 'crypto';
import { readFile, writeFile, stat } from 'fs/promises';
import { resolve, relative, dirname, basename } from 'path';
import type { VFManifest, VFArtifact, SRIString } from 'verifyfetch';

interface SignOptions {
  out: string;
  base: string;
  algorithm: 'sha256' | 'sha384' | 'sha512';
  update: boolean;
}

export const signCommand = new Command('sign')
  .description('Generate SRI hashes for files and create a manifest')
  .argument('<patterns...>', 'File patterns to sign (glob syntax supported)')
  .option('-o, --out <file>', 'Output manifest file', './vf.manifest.json')
  .option('-b, --base <path>', 'Base path for URLs in manifest', '/')
  .option('-a, --algorithm <alg>', 'Hash algorithm (sha256, sha384, sha512)', 'sha256')
  .option('-u, --update', 'Update existing manifest instead of replacing', false)
  .action(async (patterns: string[], options: SignOptions) => {
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
      let manifest: VFManifest;
      const outPath = resolve(options.out);

      if (options.update) {
        try {
          const existing = await readFile(outPath, 'utf-8');
          manifest = JSON.parse(existing) as VFManifest;
          spinner.text = `Updating existing manifest with ${uniqueFiles.length} file(s)...`;
        } catch {
          // Create new if doesn't exist
          manifest = createEmptyManifest(options.base);
        }
      } else {
        manifest = createEmptyManifest(options.base);
      }

      // Process each file
      const cwd = process.cwd();
      const results: Array<{ path: string; sri: SRIString; size: number }> = [];

      for (const filePath of uniqueFiles) {
        const relativePath = relative(cwd, filePath);
        spinner.text = `Hashing ${relativePath}...`;

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

        manifest.artifacts[manifestPath] = {
          sri,
        };

        results.push({
          path: manifestPath,
          sri,
          size: fileStats.size,
        });
      }

      // Write manifest
      spinner.text = 'Writing manifest...';
      await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n');

      spinner.succeed(chalk.green(`Signed ${results.length} file(s)`));

      // Show results
      console.log('\n' + chalk.dim('Generated hashes:'));
      for (const result of results) {
        const sizeStr = formatSize(result.size);
        console.log(
          `  ${chalk.cyan(result.path)} ${chalk.dim(`(${sizeStr})`)}\n` +
          `    ${chalk.dim(result.sri)}`
        );
      }

      console.log('\n' + chalk.dim(`Manifest written to: ${relative(cwd, outPath)}`));

      // Show next steps
      console.log('\n' + chalk.bold('Next steps:'));
      console.log(`  1. Commit the manifest: ${chalk.cyan('git add ' + relative(cwd, outPath))}`);
      console.log(`  2. Use in your code:`);
      console.log(chalk.dim(`
     import { verifyFetch } from 'verifyfetch';
     const res = await verifyFetch('${results[0]?.path || '/your-file.bin'}', {
       sri: '${results[0]?.sri || 'sha256-...'}'
     });
`));

    } catch (error) {
      spinner.fail(chalk.red('Failed to sign files'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

function createEmptyManifest(base: string): VFManifest {
  return {
    version: 1,
    base,
    artifacts: {},
  };
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
