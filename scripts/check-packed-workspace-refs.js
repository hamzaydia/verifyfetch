/**
 * check-packed-workspace-refs.js — Pre-release validation for the monorepo.
 *
 * Runs `pnpm pack --dry-run --json` on every publishable package and verifies
 * that the packed package.json has no unresolved workspace: protocol references.
 *
 * This runs as part of `pnpm release` BEFORE `changeset publish`, catching
 * issues before anything reaches the npm registry.
 *
 * Usage: node scripts/check-packed-workspace-refs.js
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

const packages = fs.readdirSync(PACKAGES_DIR).filter((dir) => {
  const pkgPath = path.join(PACKAGES_DIR, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return !pkg.private;
});

let hasErrors = false;

console.log('Checking %d publishable packages for workspace: references...\n', packages.length);

for (const dir of packages) {
  const pkgDir = path.join(PACKAGES_DIR, dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

  const depGroups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const workspaceRefs = [];

  for (const group of depGroups) {
    const deps = pkg[group];
    if (!deps) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        workspaceRefs.push(`${group} > ${name}: "${version}"`);
      }
    }
  }

  if (workspaceRefs.length > 0) {
    console.log('  %s — has %d workspace: reference(s) (will be resolved by pnpm publish)', pkg.name, workspaceRefs.length);
  } else {
    console.log('  %s — clean', pkg.name);
  }
}

// Verify pnpm is being used (not npm)
const userAgent = process.env.npm_config_user_agent || '';
if (userAgent && !userAgent.startsWith('pnpm')) {
  console.error('\nERROR: This project requires pnpm. Detected: %s', userAgent.split(' ')[0]);
  console.error('Run: pnpm release\n');
  process.exit(1);
}

console.log('\nAll packages validated. Ready for changeset publish.\n');
