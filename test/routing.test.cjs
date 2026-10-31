const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  globalRouting, removeGlobalRouting, skillRouting, reconcile, inspectRouting,
} = require('../scripts/routing.cjs');

function fixture() {
  const state = path.resolve(__dirname, '../state');
  fs.mkdirSync(state, {recursive: true});
  const root = fs.mkdtempSync(path.join(state, 'routing-test-'));
  const codexHome = path.join(root, '.codex');
  const runtimeRoot = path.join(root, 'runtime');
  const companion = path.join(runtimeRoot, 'plugins/remotion-studio-zh/skills/remotion-studio-zh/SKILL.md');
  fs.mkdirSync(path.dirname(companion), {recursive: true});
  fs.writeFileSync(companion, '---\nname: companion\ndescription: Test companion\n---\n');
  fs.mkdirSync(codexHome, {recursive: true});
  const userRules = 'User rules changed after the original installation.\n';
  fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), userRules);
  return {root, codexHome, runtimeRoot, backupRoot: path.join(root, 'backups'), userRules};
}

function addPlugin(f, version = 'snapshot-a') {
  const root = path.join(f.codexHome, 'plugins/cache/official/remotion', version);
  fs.mkdirSync(path.join(root, '.codex-plugin'), {recursive: true});
  fs.writeFileSync(path.join(root, '.codex-plugin/plugin.json'), JSON.stringify({name: 'remotion', skills: './skills'}));
  const targets = [];
  for (const name of ['remotion-best-practices', 'remotion-studio']) {
    const file = path.join(root, 'skills', name, 'SKILL.md');
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, `---\r\nname: ${name}\r\ndescription: Original description\r\n---\r\n\r\n# Original content\r\nPreserve this custom note.\r\n`);
    targets.push(file);
  }
  return targets;
}

function permissionDeniedFor(targets, code = 'EACCES') {
  const wrapped = Object.create(fs);
  wrapped.writeFileSync = (file, ...args) => {
    if (targets.includes(file)) {
      const error = new Error('Simulated file permission denial');
      error.code = code;
      throw error;
    }
    return fs.writeFileSync(file, ...args);
  };
  return wrapped;
}

test('local skill integration replaces global routing and preserves the current user rules', () => {
  const f = fixture();
  const targets = addPlugin(f);
  const globalFile = path.join(f.codexHome, 'AGENTS.md');
  fs.writeFileSync(globalFile, globalRouting(f.userRules, '/old/runtime/SKILL.md') + 'Another user addition.\n');
  const result = reconcile(f);
  assert.equal(result.mode, 'remotion-skills');
  assert.equal(result.injected.length, 2);
  const globalText = fs.readFileSync(globalFile, 'utf8');
  assert.ok(globalText.startsWith(f.userRules));
  assert.ok(globalText.includes('Another user addition.'));
  assert.equal(globalText.includes('remotion-studio-zh:start'), false);
  for (const file of targets) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.startsWith('---\r\n'));
    assert.ok(content.includes('Preserve this custom note.'));
    assert.equal((content.match(/remotion-studio-zh:skill:start/g) ?? []).length, 1);
  }
  assert.equal(reconcile(f).modified.length, 0);
});

test('only an actual local write denial selects the global fallback', () => {
  const f = fixture();
  const targets = addPlugin(f);
  const before = targets.map((file) => fs.readFileSync(file, 'utf8'));
  const result = reconcile({...f, fsApi: permissionDeniedFor(targets)});
  assert.equal(result.mode, 'global-fallback');
  assert.equal(result.denied.length, 2);
  assert.ok(fs.readFileSync(path.join(f.codexHome, 'AGENTS.md'), 'utf8').startsWith(f.userRules));
  assert.deepEqual(targets.map((file) => fs.readFileSync(file, 'utf8')), before);
  assert.equal(reconcile(f).mode, 'remotion-skills');
  assert.equal(inspectRouting(f).globalRoutingPresent, false);
});

test('ordinary launcher repair does not introduce a new global fallback', () => {
  const f = fixture();
  const targets = addPlugin(f);
  const result = reconcile({...f, allowGlobalFallback: false, fsApi: permissionDeniedFor(targets)});
  assert.equal(result.mode, 'companion-only');
  assert.equal(fs.readFileSync(path.join(f.codexHome, 'AGENTS.md'), 'utf8'), f.userRules);
});

test('missing official Remotion does not create global instructions', () => {
  const f = fixture();
  assert.equal(reconcile(f).missingRemotion, true);
  assert.equal(fs.readFileSync(path.join(f.codexHome, 'AGENTS.md'), 'utf8'), f.userRules);
});

test('disk errors do not silently turn into global routing', () => {
  const f = fixture();
  const targets = addPlugin(f);
  assert.throws(() => reconcile({...f, fsApi: permissionDeniedFor(targets, 'ENOSPC')}), /Simulated/);
  assert.equal(fs.readFileSync(path.join(f.codexHome, 'AGENTS.md'), 'utf8'), f.userRules);
});

test('a newly installed plugin snapshot is detected and repaired', () => {
  const f = fixture();
  addPlugin(f);
  reconcile(f);
  const newer = addPlugin(f, 'snapshot-b');
  assert.deepEqual(inspectRouting(f).pending, newer);
  const result = reconcile(f);
  assert.equal(result.modified.length, 2);
  assert.equal(inspectRouting(f).pending.length, 0);
});

test('a replaced skill file is repaired while preserving new upstream text', () => {
  const f = fixture();
  const targets = addPlugin(f);
  reconcile(f);
  fs.writeFileSync(targets[0], '---\nname: remotion-best-practices\ndescription: Updated\n---\nNew upstream workflow.\n');
  reconcile(f);
  assert.ok(fs.readFileSync(targets[0], 'utf8').includes('New upstream workflow.'));
});

test('malformed markers leave the affected file unchanged', () => {
  const malformed = 'Custom rule.\n<!-- remotion-studio-zh:skill:start -->\n';
  assert.throws(() => skillRouting(malformed, '/runtime/SKILL.md'), /Malformed/);
  assert.throws(() => removeGlobalRouting('<!-- remotion-studio-zh:start -->'), /Malformed/);
});

test('global cleanup refusal is reported rather than hidden', () => {
  const f = fixture();
  addPlugin(f);
  const globalFile = path.join(f.codexHome, 'AGENTS.md');
  fs.writeFileSync(globalFile, globalRouting(f.userRules, '/runtime/SKILL.md'));
  const result = reconcile({...f, fsApi: permissionDeniedFor([globalFile])});
  assert.equal(result.mode, 'remotion-skills');
  assert.equal(result.globalCleanupPending, true);
  assert.equal(inspectRouting(f).globalRoutingPresent, true);
});
