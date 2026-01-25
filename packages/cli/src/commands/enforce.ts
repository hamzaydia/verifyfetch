/**
 * Enforce Command
 *
 * Verifies that all files in the manifest match their recorded hashes.
 * Use this in CI to catch accidental or malicious changes.
 *
 * Usage:
 *   npx verifyfetch enforce --manifest ./public/vf.manifest.json
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createHash } from 'crypto';
import { readFile, access } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import type { VFManifest, SRIString } from 'verifyfetch';

interface EnforceOptions {
  manifest: string;
  strict: boolean;
  basePath?: string;
}

interface VerificationResult {
  path: string;
  expected: SRIString;
  actual?: SRIString;
  status: 'ok' | 'mismatch' | 'missing';
}

export const enforceCommand = new Command('enforce')
  .description('Verify files match their manifest hashes (for CI)')
  .option('-m, --manifest <file>', 'Manifest file to verify', './vf.manifest.json')
  .option('-s, --strict', 'Fail if any extra files exist in directories', false)
  .option('-p, --base-path <path>', 'Base path to resolve files from')
  .action(async (options: EnforceOptions) => {
    const spinner = ora('Loading manifest...').start();

    try {
      // Load manifest
      const manifestPath = resolve(options.manifest);
      let manifestContent: string;

      try {
        manifestContent = await readFile(manifestPath, 'utf-8');
      } catch {
        spinner.fail(chalk.red(`Manifest not found: ${options.manifest}`));
        console.log('\n' + chalk.dim('Generate a manifest first:'));
        console.log(chalk.cyan('  npx verifyfetch sign ./public/**/*.wasm'));
        process.exit(1);
      }

      const manifest: VFManifest = JSON.parse(manifestContent);

      if (manifest.version !== 1) {
        spinner.fail(chalk.red(`Unsupported manifest version: ${manifest.version}`));
        process.exit(1);
      }

      const artifactPaths = Object.keys(manifest.artifacts);

      if (artifactPaths.length === 0) {
        spinner.fail(chalk.red('Manifest contains no artifacts'));
        process.exit(1);
      }

      spinner.text = `Verifying ${artifactPaths.length} file(s)...`;

      // Determine base path for file resolution
      const basePath = options.basePath
        ? resolve(options.basePath)
        : dirname(manifestPath);

      // Verify each file
      const results: VerificationResult[] = [];
      let failed = 0;
      let passed = 0;
      let missing = 0;

      for (const artifactPath of artifactPaths) {
        const artifact = manifest.artifacts[artifactPath];
        const algorithm = artifact.sri.split('-')[0] as string;

        // Resolve file path
        let filePath: string;
        if (artifactPath.startsWith('/')) {
          // Absolute path in manifest - resolve from base
          filePath = join(basePath, artifactPath);
        } else {
          filePath = join(basePath, artifactPath);
        }

        spinner.text = `Verifying ${artifactPath}...`;

        // Check if file exists
        try {
          await access(filePath);
        } catch {
          results.push({
            path: artifactPath,
            expected: artifact.sri,
            status: 'missing',
          });
          missing++;
          continue;
        }

        // Read and hash file
        const content = await readFile(filePath);
        const actualHash = createHash(algorithm).update(content).digest('base64');
        const actualSri = `${algorithm}-${actualHash}` as SRIString;

        if (actualSri === artifact.sri) {
          results.push({
            path: artifactPath,
            expected: artifact.sri,
            actual: actualSri,
            status: 'ok',
          });
          passed++;
        } else {
          results.push({
            path: artifactPath,
            expected: artifact.sri,
            actual: actualSri,
            status: 'mismatch',
          });
          failed++;
        }
      }

      // Report results
      if (failed > 0 || missing > 0) {
        spinner.fail(chalk.red(`Verification failed: ${failed} mismatch(es), ${missing} missing`));
      } else {
        spinner.succeed(chalk.green(`All ${passed} file(s) verified successfully`));
      }

      // Show detailed results
      console.log('\n' + chalk.bold('Verification Results:'));
      console.log(chalk.dim('─'.repeat(60)));

      for (const result of results) {
        const icon = result.status === 'ok'
          ? chalk.green('✓')
          : result.status === 'missing'
            ? chalk.yellow('?')
            : chalk.red('✗');

        console.log(`${icon} ${result.path}`);

        if (result.status === 'mismatch') {
          console.log(chalk.dim(`    Expected: ${result.expected}`));
          console.log(chalk.red(`    Actual:   ${result.actual}`));
          console.log(chalk.dim(`    Fix: npx verifyfetch sign ${result.path} --update`));
        } else if (result.status === 'missing') {
          console.log(chalk.yellow('    File not found'));
        }
      }

      console.log(chalk.dim('─'.repeat(60)));
      console.log(
        `${chalk.green(`${passed} passed`)} | ` +
        `${chalk.red(`${failed} failed`)} | ` +
        `${chalk.yellow(`${missing} missing`)}`
      );

      // Exit with appropriate code
      if (failed > 0 || missing > 0) {
        console.log('\n' + chalk.red('Integrity check failed!'));
        console.log(chalk.dim('This could indicate:'));
        console.log(chalk.dim('  - Files were modified after signing'));
        console.log(chalk.dim('  - Manifest is out of date'));
        console.log(chalk.dim('  - Potential supply chain compromise'));
        console.log('\n' + chalk.dim('To update the manifest:'));
        console.log(chalk.cyan('  npx verifyfetch sign <files> --out ' + options.manifest));
        process.exit(1);
      }

      console.log('\n' + chalk.green('All integrity checks passed.'));

    } catch (error) {
      spinner.fail(chalk.red('Verification failed'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });
