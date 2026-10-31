const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const walk = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) {
    return ['node_modules', 'state', 'backups', '.git', 'artifacts'].includes(entry.name) ? [] : walk(file);
  }
  return [file];
});

const files = walk(root);
for (const file of files) {
  if (file.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
  if (file.endsWith('.cjs')) {
    const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8', windowsHide: true});
    assert.equal(result.status, 0, result.stderr);
  }
}
const manifest = require('../package.json');
const lock = require('../package-lock.json');
const plugin = require('../plugins/remotion-studio-zh/.codex-plugin/plugin.json');
const dictionary = require('../locales/zh-CN.json');
assert.equal(manifest.license, 'Unlicense');
assert.equal(lock.packages[''].license, manifest.license);
assert.equal(plugin.license, manifest.license);
assert.ok(Object.values(dictionary).every((value) => typeof value === 'string'));
for (const file of ['README.md', 'LICENSE', 'INSTALL.md', 'CONTRIBUTING.md', 'docs/preview.png']) {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}
assert.ok(!files.some((file) => path.basename(file) === 'runtime.json'), 'Do not publish machine-specific runtime registration.');
console.log(`Package checks passed: ${files.length} files; ${Object.keys(dictionary).length} dictionary entries.`);
