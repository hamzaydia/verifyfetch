/**
 * Tests for prepack-check.js
 *
 * Verifies that the prepack guard correctly:
 * - BLOCKS npm/yarn from packing workspace packages
 * - ALLOWS pnpm to pack workspace packages
 * - ALLOWS running without a package manager (plain node)
 *
 * Run: node scripts/prepack-check.test.js
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const SCRIPT = path.resolve(__dirname, 'prepack-check.js');
let tmpDir;
let passed = 0;
let failed = 0;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepack-check-test-'));
  // Create a minimal package.json so the script can read pkg.name
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test-pkg', version: '1.0.0', dependencies: { foo: 'workspace:^' } })
  );
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function runWithAgent(agent) {
  const env = { ...process.env };
  if (agent === null) {
    delete env.npm_config_user_agent;
  } else {
    env.npm_config_user_agent = agent;
  }
  return execSync(`node "${SCRIPT}"`, {
    cwd: tmpDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

function test(name, fn) {
  setup();
  try {
    fn();
    passed++;
    console.log('  PASS: %s', name);
  } catch (err) {
    failed++;
    console.error('  FAIL: %s', name);
    console.error('        %s', err.message);
  } finally {
    teardown();
  }
}

console.log('');
console.log('prepack-check.js tests');
console.log('');

// --- Should FAIL (block pack/publish) ---

test('blocks npm', () => {
  let threw = false;
  try {
    runWithAgent('npm/10.2.0 node/v20.0.0');
  } catch (err) {
    threw = true;
    assert.ok(err.stderr.includes('npm/10.2.0'), 'Should mention the detected tool');
    assert.ok(err.stderr.includes('pnpm'), 'Should suggest pnpm');
    assert.ok(err.status !== 0, 'Should exit non-zero');
  }
  assert.ok(threw, 'Should have thrown');
});

test('blocks yarn', () => {
  let threw = false;
  try {
    runWithAgent('yarn/4.0.0 npm/? node/v20.0.0');
  } catch (err) {
    threw = true;
    assert.ok(err.stderr.includes('yarn/4.0.0'), 'Should mention yarn');
  }
  assert.ok(threw, 'Should have thrown');
});

test('blocks bun', () => {
  let threw = false;
  try {
    runWithAgent('bun/1.0.0');
  } catch (err) {
    threw = true;
    assert.ok(err.stderr.includes('bun/1.0.0'), 'Should mention bun');
  }
  assert.ok(threw, 'Should have thrown');
});

test('error message includes package name', () => {
  try {
    runWithAgent('npm/10.0.0 node/v20.0.0');
  } catch (err) {
    assert.ok(err.stderr.includes('test-pkg'), 'Should include package name');
  }
});

test('error message suggests pnpm release', () => {
  try {
    runWithAgent('npm/10.0.0 node/v20.0.0');
  } catch (err) {
    assert.ok(err.stderr.includes('pnpm release'), 'Should suggest pnpm release');
    assert.ok(err.stderr.includes('pnpm publish'), 'Should suggest pnpm publish');
  }
});

// --- Should PASS (allow pack/publish) ---

test('allows pnpm 9.x', () => {
  runWithAgent('pnpm/9.15.0 npm/? node/v20.0.0');
});

test('allows pnpm 10.x', () => {
  runWithAgent('pnpm/10.0.0 npm/? node/v22.0.0');
});

test('allows no user agent (plain node / tests)', () => {
  runWithAgent(null);
});

test('allows empty user agent string', () => {
  runWithAgent('');
});

// --- Summary ---

console.log('');
console.log('%d passed, %d failed, %d total', passed, failed, passed + failed);
console.log('');

if (failed > 0) {
  process.exit(1);
}
