import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { generate, release, validate } from './registry.mjs';

const entry = (overrides = '') => `---
jira: null
title: Sample
type: feature
status: active
valid_until: Never
files:
  - a.txt
checks:
  - exists a.txt
changes:
  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing" }
${overrides}---

Body
`;

const fixture = ({
  version = '2.3.0',
  pkg = 'v0.8.7',
  files = { 'baseline-sample.md': entry() },
} = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'mia-registry-'));
  mkdirSync(join(root, 'docs', 'mia', 'customizations'), { recursive: true });
  writeFileSync(join(root, 'docs', 'mia', 'VERSION'), `${version}\n`);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: pkg }));
  Object.entries(files).forEach(([name, text]) =>
    writeFileSync(join(root, 'docs', 'mia', 'customizations', name), text),
  );
  return root;
};

test('a valid baseline entry passes', () => {
  assert.deepEqual(validate(fixture()), []);
});

test('a Jira entry must be named after its key', () => {
  const root = fixture({ files: { 'MIA-1.md': entry().replace('jira: null', 'jira: MIA-2') } });
  assert.match(validate(root).join('\n'), /file name must equal the Jira key/);
});

test('a non-baseline change requires a Jira key', () => {
  const text = entry().replace('kind: baseline', 'kind: fixed');
  assert.match(
    validate(fixture({ files: { 'baseline-sample.md': text } })).join('\n'),
    /jira must look like MIA-254/,
  );
});

test('a change newer than docs/mia/VERSION is rejected', () => {
  const text = entry().replace('mia: 2.3.0', 'mia: 2.4.0');
  assert.match(
    validate(fixture({ files: { 'baseline-sample.md': text } })).join('\n'),
    /newer than docs\/mia\/VERSION/,
  );
});

test('removed status must match the latest change', () => {
  const text = entry().replace('status: active', 'status: removed');
  assert.match(
    validate(fixture({ files: { 'baseline-sample.md': text } })).join('\n'),
    /latest change is not/,
  );
});

test('release resolves versions and detects a base mismatch', () => {
  assert.deepEqual(release(fixture()).errors, []);
  assert.match(release(fixture({ pkg: 'v0.8.8' })).errors.join('\n'), /package\.json is v0\.8\.8/);
  assert.match(
    release(fixture({ version: '2.4.0' })).errors.join('\n'),
    /no registry change is recorded for MIA 2\.4\.0/,
  );
});

test('generate writes files and --check detects drift', () => {
  const root = fixture();
  assert.deepEqual(generate(root), []);
  assert.deepEqual(generate(root, { verify: true }), []);
  writeFileSync(join(root, 'CHANGELOG-MIA.md'), 'stale');
  assert.deepEqual(generate(root, { verify: true }), ['CHANGELOG-MIA.md']);
});
