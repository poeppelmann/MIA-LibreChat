import test from 'node:test';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  check,
  compareVersions,
  generate,
  release,
  review,
  tagState,
  validate,
} from './registry.mjs';

const cli = join(dirname(fileURLToPath(import.meta.url)), 'registry.mjs');

const entry = ({
  status = 'active',
  changes,
  extra = '',
  checks = '  - exists a.txt\n',
} = {}) => `---
jira: null
title: Sample
type: feature
status: ${status}
valid_until: Never
files:
  - a.txt
checks:
${checks}changes:
${changes ?? '  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "Existing" }\n'}${extra}---

Body
`;

const fixture = (
  t,
  { version = '2.3.0', pkg = 'v0.8.7', files = { 'baseline-sample.md': entry() } } = {},
) => {
  const root = mkdtempSync(join(tmpdir(), 'mia-registry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs', 'mia', 'customizations'), { recursive: true });
  writeFileSync(join(root, 'docs', 'mia', 'VERSION'), `${version}\n`);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: pkg }));
  Object.entries(files).forEach(([name, text]) =>
    writeFileSync(join(root, 'docs', 'mia', 'customizations', name), text),
  );
  return root;
};

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const gitFixture = (t, options) => {
  const root = fixture(t, options);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  writeFileSync(join(root, 'a.txt'), 'upstream\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'upstream v1');
  git(root, 'tag', 'v1');
  writeFileSync(join(root, 'a.txt'), 'upstream\nrenamed later\n');
  writeFileSync(join(root, 'b.txt'), 'new\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'upstream v2');
  git(root, 'tag', 'v2');
  return root;
};

const errorsOf = (t, text) =>
  validate(fixture(t, { files: { 'baseline-sample.md': text } })).join('\n');

test('a valid baseline entry passes', (t) => {
  assert.deepEqual(validate(fixture(t)), []);
});

test('versions compare numerically per segment', () => {
  assert.ok(compareVersions('2.10.0', '2.9.0') > 0);
  assert.ok(compareVersions('v0.8.7', 'v0.8.8') < 0);
  assert.equal(compareVersions('2.3.0', '2.3.0'), 0);
});

test('a Jira entry must be named after its key', (t) => {
  const root = fixture(t, {
    files: { 'MIA-1.md': entry().replace('jira: null', 'jira: MIA-2') },
  });
  assert.match(validate(root).join('\n'), /file name must equal the Jira key/);
});

test('two entries cannot share a Jira key', (t) => {
  const text = entry({
    changes: '  - { mia: 2.3.0, base: v0.8.7, kind: fixed, jira: MIA-5, note: "x" }\n',
  }).replace('jira: null', 'jira: MIA-5');
  const root = fixture(t, { files: { 'MIA-5.md': text, 'baseline-other.md': text } });
  assert.match(validate(root).join('\n'), /Jira key used by more than one entry/);
});

test('a non-baseline change requires a Jira key', (t) => {
  const text = entry({ changes: '  - { mia: 2.3.0, base: v0.8.7, kind: fixed, note: "x" }\n' });
  assert.match(errorsOf(t, text), /jira must look like MIA-254/);
});

test('a change newer than docs/mia/VERSION is rejected', (t) => {
  const text = entry({ changes: '  - { mia: 2.4.0, base: v0.8.7, kind: baseline, note: "x" }\n' });
  assert.match(errorsOf(t, text), /newer than docs\/mia\/VERSION/);
});

test('changes must be listed newest first', (t) => {
  const text = entry({
    changes: [
      '  - { mia: 2.2.0, base: v0.8.6, kind: baseline, note: "old" }',
      '  - { mia: 2.3.0, base: v0.8.7, kind: kept, jira: MIA-1, note: "new" }',
      '',
    ].join('\n'),
  });
  assert.match(errorsOf(t, text), /newest first/);
});

test('removed status must match the newest change', (t) => {
  assert.match(
    errorsOf(t, entry({ status: 'removed' })),
    /status is "removed" but the newest change/,
  );
  const removedBelow = entry({
    changes: [
      '  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "x" }',
      '  - { mia: 2.3.0, base: v0.8.7, kind: removed, jira: MIA-1, note: "y" }',
      '',
    ].join('\n'),
  });
  assert.match(errorsOf(t, removedBelow), /has a "removed" change but status is "active"/);
});

test('unknown keys, wrong types and missing checks are rejected', (t) => {
  assert.match(
    errorsOf(t, entry({ extra: 'checks_disabled: []\n' })),
    /unknown key "checks_disabled"/,
  );
  assert.match(
    errorsOf(t, entry().replace('checks:\n  - exists a.txt', 'checks: exists a.txt')),
    /checks must list/,
  );
  assert.match(
    errorsOf(t, entry({ checks: '' }).replace('checks:\nchanges', 'checks: []\nchanges')),
    /checks must list at least one check/,
  );
});

test('unparsable checks and non-mapping changes are reported', (t) => {
  assert.match(
    errorsOf(t, entry({ checks: '  - bogus a.txt\n' })),
    /unparsable check "bogus a.txt"/,
  );
  assert.match(errorsOf(t, entry({ changes: '  - null\n' })), /must be a mapping/);
});

test('an empty registry and stray files are rejected', (t) => {
  assert.match(validate(fixture(t, { files: {} })).join('\n'), /has no entries/);
  assert.match(
    validate(fixture(t, { files: { 'baseline-sample.md': entry(), 'NOTES.txt': 'x' } })).join('\n'),
    /only \.md files are read/,
  );
});

test('CRLF files are parsed', (t) => {
  const root = fixture(t, { files: { 'baseline-sample.md': entry().replace(/\n/g, '\r\n') } });
  assert.deepEqual(validate(root), []);
});

test('release resolves versions and detects problems', (t) => {
  assert.deepEqual(release(fixture(t)).errors, []);
  assert.match(
    release(fixture(t, { pkg: 'v0.8.8' })).errors.join('\n'),
    /package\.json is v0\.8\.8/,
  );
  assert.match(
    release(fixture(t, { version: '2.4.0' })).errors.join('\n'),
    /no registry change is recorded for MIA 2\.4\.0/,
  );
  const twoBases = entry({
    changes: [
      '  - { mia: 2.3.0, base: v0.8.8, kind: kept, jira: MIA-1, note: "x" }',
      '  - { mia: 2.3.0, base: v0.8.7, kind: baseline, note: "y" }',
      '',
    ].join('\n'),
  });
  const root = fixture(t, { files: { 'baseline-sample.md': twoBases } });
  assert.match(release(root).errors.join('\n'), /more than one LibreChat base/);
});

test('generate writes files and --check detects drift', (t) => {
  const root = fixture(t);
  assert.deepEqual(generate(root), []);
  assert.deepEqual(generate(root, { verify: true }), []);
  writeFileSync(join(root, 'CHANGELOG-MIA.md'), 'stale');
  assert.deepEqual(generate(root, { verify: true }), ['CHANGELOG-MIA.md']);
});

test('check reports missing, unchanged and passing files', (t) => {
  const checks = [
    '  - exists a.txt',
    '  - contains a.txt => renamed later',
    '  - contains a.txt => not there',
    '  - exists missing.txt',
    '  - differs a.txt',
    '',
  ].join('\n');
  const root = gitFixture(t, { files: { 'baseline-sample.md': entry({ checks }) } });
  const { ok, failures } = check(root, 'v1');
  assert.equal(ok, 3);
  assert.deepEqual(
    failures.map((f) => f.error),
    ['a.txt does not contain: not there', 'missing.txt is missing'],
  );
  assert.throws(() => check(root, 'v9'), /not found locally/);
});

test('check flags a file identical to the upstream tag', (t) => {
  const root = gitFixture(t, {
    files: { 'baseline-sample.md': entry({ checks: '  - differs a.txt\n' }) },
  });
  git(root, 'checkout', '-q', 'v1', '--', 'a.txt');
  assert.match(check(root, 'v1').failures[0].error, /identical to v1/);
});

test('review lists customizations whose files changed upstream', (t) => {
  const root = gitFixture(t);
  const [result] = review(root, 'v1', 'v2');
  assert.deepEqual(result.touched, [{ status: 'M', paths: ['a.txt'] }]);
  assert.throws(() => review(root, 'v1', 'v9'), /not found locally/);
});

test('tagState distinguishes free, existing and unreachable', (t) => {
  const root = gitFixture(t);
  const remote = mkdtempSync(join(tmpdir(), 'mia-remote-'));
  t.after(() => rmSync(remote, { recursive: true, force: true }));
  git(remote, 'init', '-q', '--bare');
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-q', 'origin', 'HEAD:refs/heads/main', 'refs/tags/v1');
  assert.equal(tagState(root, 'v1'), 'exists');
  assert.equal(tagState(root, 'v2'), 'free');
  assert.throws(() => tagState(root, 'v1', join(remote, 'missing')), /cannot determine/);
});

test('the CLI exits non-zero on invalid input', (t) => {
  const run = (...args) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  assert.equal(run('nonsense').status, 2);
  assert.equal(run('check').status, 2);
  assert.equal(run('validate').status, 0);
  t.diagnostic('validate ran against the real registry');
});
