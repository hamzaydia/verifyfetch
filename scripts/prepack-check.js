/**
 * prepack-check.js — Blocks npm/yarn from packing or publishing workspace packages.
 *
 * pnpm resolves workspace: protocol references in the tarball output (not on disk),
 * so this script cannot check package.json contents — they will always contain
 * workspace: references in source. Instead, it detects which package manager is
 * running and blocks anything other than pnpm.
 *
 * - pnpm pack/publish → allowed (pnpm resolves workspace: in tarball)
 * - npm pack/publish  → blocked (npm doesn't understand workspace: protocol)
 * - yarn pack/publish → blocked (same issue)
 *
 * Usage: Add to each publishable package.json:
 *   "prepack": "node ../../scripts/prepack-check.js"
 */

'use strict';

const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent) {
  // No user agent — running as a plain node script, not from a package manager.
  // Allow this (e.g., tests calling the script directly).
  process.exit(0);
}

if (userAgent.startsWith('pnpm/')) {
  // pnpm handles workspace: resolution in the tarball. All good.
  process.exit(0);
}

// Anything else (npm, yarn, etc.) will produce a broken tarball.
const tool = userAgent.split(' ')[0] || 'unknown';
const pkg = require(require('path').join(process.cwd(), 'package.json'));

console.error('');
console.error('ERROR: %s cannot pack/publish workspace packages.', tool);
console.error('');
console.error('Package: %s', pkg.name);
console.error('');
console.error('This monorepo uses pnpm workspace: protocol references.');
console.error('%s does not resolve these, producing broken packages on npm.', tool);
console.error('');
console.error('Use pnpm instead:');
console.error('  pnpm release     # from monorepo root (recommended)');
console.error('  pnpm publish     # from this package directory');
console.error('');
process.exit(1);
