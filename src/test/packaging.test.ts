import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VERSION } from '../config.js';

/**
 * Packaging guards — the shipped metadata must point at the real repository
 * and every version surface must agree. Both defects (build-slug URLs, version
 * drift) shipped in v0.1.0; these tests keep them from coming back.
 */

const REPO = 'https://github.com/SuperMarioYL/n-bridge';

test('package metadata points at the canonical repository', async () => {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  assert.equal(pkg.repository?.url, `git+${REPO}.git`);
  assert.equal(pkg.homepage, REPO);
  assert.equal(pkg.bugs?.url, `${REPO}/issues`);
});

test('no build-slug URLs leak into user-facing files', async () => {
  for (const f of ['package.json', 'README.md', 'README.en.md', 'src/index.ts']) {
    const text = await fs.readFile(f, 'utf8');
    assert.ok(!text.includes('--ma7c2n4k'), `${f} still contains a build-slug URL`);
  }
});

test('version surfaces agree: VERSION file, package.json, config, changelog', async () => {
  const versionFile = (await fs.readFile('VERSION', 'utf8')).trim();
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  assert.equal(versionFile, VERSION);
  assert.equal(pkg.version, VERSION);
  const changelog = await fs.readFile('CHANGELOG.md', 'utf8');
  assert.ok(
    changelog.includes(`## [${VERSION}]`),
    'CHANGELOG has an entry for the shipped version',
  );
});

test('`nbridge --version` prints the shipped version', () => {
  const out = execFileSync(process.execPath, ['dist/index.js', '--version'], {
    encoding: 'utf8',
  }).trim();
  assert.equal(out, VERSION);
});
