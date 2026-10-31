const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {globalRouting: updateRouting, reconcile} = require('./routing.cjs');

function install() {
  const root = path.resolve(__dirname, '..');
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
  const codex = process.argv[2];
  if (!codex) throw new Error('Pass the path of codex.js or the native Codex executable.');
  require('../src/translate.cjs');
  const plugin = path.join(root, 'plugins/remotion-studio-zh');
  fs.writeFileSync(path.join(plugin, 'runtime.json'), JSON.stringify({runtimeRoot: root}, null, 2) + '\n');
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const backup = path.join(root, 'backups', stamp);
  fs.mkdirSync(backup, {recursive: true});
  for (const file of ['config.toml', 'AGENTS.md']) {
    const source = path.join(codexHome, file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(backup, file));
  }
  const command = codex.endsWith('.js') ? process.execPath : codex;
  const prefix = codex.endsWith('.js') ? [codex] : [];
  for (const args of [
    ['plugin', 'marketplace', 'add', root, '--json'],
    ['plugin', 'add', 'remotion-studio-zh@remotion-zh-local', '--json'],
  ]) {
    const result = spawnSync(command, [...prefix, ...args], {encoding: 'utf8', windowsHide: true});
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error('Codex plugin installation failed; routing was not changed.');
  }
  const routing = reconcile({codexHome, runtimeRoot: root, backupRoot: path.join(backup, 'routing')});
  const result = {
    installedAt: new Date().toISOString(), runtimeRoot: root,
    plugin: 'remotion-studio-zh@remotion-zh-local', backup, routing,
  };
  fs.writeFileSync(path.join(root, 'installation.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try { install(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {updateRouting};
