const path = require('node:path');
const os = require('node:os');
const {reconcile, inspectRouting} = require('./routing.cjs');

function repairRouting({allowGlobalFallback = false} = {}) {
  const runtimeRoot = path.resolve(__dirname, '..');
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
  const backupRoot = path.join(runtimeRoot, 'backups',
    new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'), 'routing');
  return reconcile({codexHome, runtimeRoot, backupRoot, allowGlobalFallback});
}

if (require.main === module) {
  try {
    const command = process.argv[2] ?? 'status';
    if (!['status', 'repair'].includes(command) ||
        process.argv.slice(3).some((arg) => arg !== '--allow-global-fallback')) {
      throw new Error('Use status or repair [--allow-global-fallback].');
    }
    const result = command === 'status'
      ? inspectRouting({
        runtimeRoot: path.resolve(__dirname, '..'),
        codexHome: process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'),
      })
      : repairRouting({allowGlobalFallback: process.argv.includes('--allow-global-fallback')});
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {repairRouting};
