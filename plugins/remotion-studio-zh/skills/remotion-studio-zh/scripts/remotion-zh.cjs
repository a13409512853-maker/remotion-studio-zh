const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');

const pluginRoot = path.resolve(__dirname, '../../..');
const registry = path.join(pluginRoot, 'runtime.json');
const root = fs.existsSync(registry)
  ? JSON.parse(fs.readFileSync(registry, 'utf8')).runtimeRoot
  : path.resolve(pluginRoot, '../..');
const child = spawn(process.execPath, [path.join(root, 'scripts/launch.cjs'), ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true,
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
