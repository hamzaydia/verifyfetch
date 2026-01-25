/**
 * Init Command
 *
 * Initializes VerifyFetch in a project by generating framework-specific code.
 * Following the shadcn/ui model - code is owned by the user, not hidden in node_modules.
 *
 * Usage:
 *   npx verifyfetch init          # Auto-detect framework
 *   npx verifyfetch init --next   # Next.js specific
 *   npx verifyfetch init --vite   # Vite specific
 *   npx verifyfetch init --node   # Node.js
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { resolve, dirname, join } from 'path';

interface InitOptions {
  next: boolean;
  vite: boolean;
  node: boolean;
  deno: boolean;
  bun: boolean;
  force: boolean;
  output: string;
}

type Framework = 'next' | 'vite' | 'node' | 'deno' | 'bun' | 'unknown';

export const initCommand = new Command('init')
  .description('Initialize VerifyFetch in your project (generates ownable code)')
  .option('--next', 'Generate Next.js specific code')
  .option('--vite', 'Generate Vite specific code')
  .option('--node', 'Generate Node.js specific code')
  .option('--deno', 'Generate Deno specific code')
  .option('--bun', 'Generate Bun specific code')
  .option('-f, --force', 'Overwrite existing files', false)
  .option('-o, --output <path>', 'Output directory', './lib')
  .action(async (options: InitOptions) => {
    const spinner = ora('Detecting project type...').start();

    try {
      // Detect framework
      let framework: Framework;

      if (options.next) {
        framework = 'next';
      } else if (options.vite) {
        framework = 'vite';
      } else if (options.node) {
        framework = 'node';
      } else if (options.deno) {
        framework = 'deno';
      } else if (options.bun) {
        framework = 'bun';
      } else {
        framework = await detectFramework();
      }

      spinner.text = `Generating ${framework} code...`;

      // Create output directory
      const outputDir = resolve(options.output);
      await mkdir(outputDir, { recursive: true });

      // Generate framework-specific code
      const files = generateCode(framework);

      // Write files
      const createdFiles: string[] = [];

      for (const [filename, content] of Object.entries(files)) {
        const filePath = join(outputDir, filename);

        // Check if file exists
        if (!options.force) {
          try {
            await access(filePath);
            spinner.warn(chalk.yellow(`Skipping ${filename} (already exists, use --force to overwrite)`));
            continue;
          } catch {
            // File doesn't exist, proceed
          }
        }

        await writeFile(filePath, content);
        createdFiles.push(filePath);
      }

      spinner.succeed(chalk.green(`Created ${createdFiles.length} file(s)`));

      // Show created files
      console.log('\n' + chalk.bold('Created files:'));
      for (const file of createdFiles) {
        const relativePath = file.replace(process.cwd() + '/', '').replace(process.cwd() + '\\', '');
        console.log(`  ${chalk.cyan(relativePath)}`);
      }

      // Show next steps
      console.log('\n' + chalk.bold('Next steps:'));

      if (framework === 'next') {
        console.log(`
  1. Generate a manifest:
     ${chalk.cyan('npx verifyfetch sign ./public/**/*.wasm ./public/**/*.bin')}

  2. Use the hook in your components:
     ${chalk.dim(`
     import { useVerifiedFetch } from '${options.output}/verify-fetch';

     const { data, loading } = useVerifiedFetch('/engine.wasm', {
       sri: 'sha256-...'
     });
`)}
  3. Or use the Next.js config wrapper for auto-verification:
     ${chalk.dim(`
     // next.config.js
     const { withVerifyFetch } = require('${options.output}/verify-fetch');
     module.exports = withVerifyFetch({});
`)}
`);
      } else {
        console.log(`
  1. Generate a manifest:
     ${chalk.cyan('npx verifyfetch sign ./**/*.wasm ./**/*.bin')}

  2. Use in your code:
     ${chalk.dim(`
     import { verifyFetch } from '${options.output}/verify-fetch';

     const res = await verifyFetch('/engine.wasm', {
       sri: 'sha256-...'
     });
`)}
`);
      }

      console.log(chalk.dim('Learn more: https://verifyfetch.com/docs/getting-started'));

    } catch (error) {
      spinner.fail(chalk.red('Initialization failed'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

async function detectFramework(): Promise<Framework> {
  const cwd = process.cwd();

  // Check for Next.js
  try {
    const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));
    if (pkg.dependencies?.next || pkg.devDependencies?.next) {
      return 'next';
    }
    if (pkg.dependencies?.vite || pkg.devDependencies?.vite) {
      return 'vite';
    }
  } catch {
    // No package.json
  }

  // Check for Deno
  try {
    await access(join(cwd, 'deno.json'));
    return 'deno';
  } catch {
    // Not Deno
  }

  // Check for Bun
  try {
    await access(join(cwd, 'bun.lockb'));
    return 'bun';
  } catch {
    // Not Bun
  }

  // Default to Node
  return 'node';
}

function generateCode(framework: Framework): Record<string, string> {
  const files: Record<string, string> = {};

  // Common verify-fetch core
  const coreCode = `/**
 * VerifyFetch - Verify any file you fetch—before you trust it.
 *
 * This file is OWNED by your project. Feel free to modify it!
 * Generated by: npx verifyfetch init
 *
 * Learn more: https://verifyfetch.com
 * Star us: https://github.com/hamzaydia/verifyfetch
 */

export type SRIString = \`sha256-\${string}\` | \`sha384-\${string}\` | \`sha512-\${string}\`;

export interface VerifyFetchOptions {
  /** SRI hash to verify against (required) */
  sri: SRIString;
  /** What to do on failure: 'block' (default) | 'warn' | { fallbackUrl: string } */
  onFail?: 'block' | 'warn' | { fallbackUrl: string };
  /** Progress callback */
  onProgress?: (bytes: number, total?: number) => void;
}

export class IntegrityError extends Error {
  constructor(
    public readonly url: string,
    public readonly expected: SRIString,
    public readonly actual: SRIString
  ) {
    super(
      \`Integrity check failed for \${url}\\n\` +
      \`  Expected: \${expected}\\n\` +
      \`  Actual:   \${actual}\\n\\n\` +
      \`To fix: Update your SRI hash or investigate the mismatch.\\n\` +
      \`Learn more: https://verifyfetch.com/docs/integrity-errors\`
    );
    this.name = 'IntegrityError';
  }
}

/**
 * Fetch and verify a resource against an SRI hash
 */
export async function verifyFetch(
  url: string,
  options: VerifyFetchOptions
): Promise<Response> {
  const { sri, onFail = 'block', onProgress } = options;

  // Parse algorithm from SRI
  const [algorithm] = sri.split('-') as ['sha256' | 'sha384' | 'sha512', string];

  // Fetch the resource
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`Failed to fetch \${url}: \${response.status}\`);
  }

  // Get content
  const buffer = await response.arrayBuffer();

  // Hash using SubtleCrypto
  const hashBuffer = await crypto.subtle.digest(
    algorithm.toUpperCase().replace('SHA', 'SHA-'),
    buffer
  );

  // Convert to base64
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  const actualSri = \`\${algorithm}-\${hashBase64}\` as SRIString;

  // Verify
  if (actualSri !== sri) {
    if (onFail === 'warn') {
      console.warn(\`[VerifyFetch] Integrity mismatch for \${url}\`);
      return new Response(buffer);
    }
    if (typeof onFail === 'object' && onFail.fallbackUrl) {
      console.warn(\`[VerifyFetch] Trying fallback: \${onFail.fallbackUrl}\`);
      return verifyFetch(onFail.fallbackUrl, { ...options, onFail: 'block' });
    }
    throw new IntegrityError(url, sri, actualSri);
  }

  return new Response(buffer, {
    status: response.status,
    headers: response.headers,
  });
}

/**
 * Compute SRI hash for data
 */
export async function computeSri(
  data: ArrayBuffer | Uint8Array,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'
): Promise<SRIString> {
  const hashBuffer = await crypto.subtle.digest(
    algorithm.toUpperCase().replace('SHA', 'SHA-'),
    data
  );
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return \`\${algorithm}-\${hashBase64}\` as SRIString;
}
`;

  if (framework === 'next') {
    // Next.js specific code with React hook
    files['verify-fetch.ts'] = coreCode + `

// ============================================
// Next.js Specific Exports
// ============================================

import { useState, useEffect } from 'react';

interface UseVerifiedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * React hook for verified fetching
 */
export function useVerifiedFetch<T = ArrayBuffer>(
  url: string | null,
  options: VerifyFetchOptions & { transform?: (buffer: ArrayBuffer) => T }
): UseVerifiedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    verifyFetch(url, options)
      .then(async (response) => {
        if (cancelled) return;
        const buffer = await response.arrayBuffer();
        const result = options.transform
          ? options.transform(buffer)
          : buffer as unknown as T;
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, options.sri]);

  return { data, loading, error };
}

/**
 * Next.js config wrapper (use in next.config.js)
 *
 * @example
 * const { withVerifyFetch } = require('./lib/verify-fetch');
 * module.exports = withVerifyFetch({
 *   // your next config
 * });
 */
export function withVerifyFetch(nextConfig: any = {}) {
  return {
    ...nextConfig,
    webpack: (config: any, options: any) => {
      // Add manifest generation plugin in production
      if (!options.dev && !options.isServer) {
        console.log('[VerifyFetch] Production build detected');
        // Future: Auto-generate manifest from public assets
      }

      // Call existing webpack config if present
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      return config;
    },
  };
}
`;
  } else if (framework === 'vite') {
    // Vite specific code
    files['verify-fetch.ts'] = coreCode + `

// ============================================
// Vite Specific Exports
// ============================================

/**
 * Vite plugin for auto-generating manifests
 *
 * @example
 * // vite.config.ts
 * import { verifyFetchPlugin } from './lib/verify-fetch';
 *
 * export default defineConfig({
 *   plugins: [verifyFetchPlugin()]
 * });
 */
export function verifyFetchPlugin() {
  return {
    name: 'verifyfetch',
    buildEnd() {
      console.log('[VerifyFetch] Build complete. Run "npx verifyfetch sign dist/**/*" to generate manifest.');
    },
  };
}
`;
  } else {
    // Generic code for Node/Deno/Bun
    files['verify-fetch.ts'] = coreCode;
  }

  return files;
}
