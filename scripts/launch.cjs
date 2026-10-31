const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const {spawn} = require('node:child_process');

const extensionRoot = path.resolve(__dirname, '..');

function parseArguments(argv) {
  const separator = argv.indexOf('--');
  const options = separator < 0 ? [...argv] : argv.slice(0, separator);
  const forwarded = separator < 0 ? [] : argv.slice(separator + 1);
  const command = options.shift() ?? 'doctor';
  const values = {command, project: process.cwd(), locale: 'zh-CN', forwarded};
  while (options.length) {
    const key = options.shift();
    if (!['--project', '--locale'].includes(key) || !options.length) {
      throw new Error(`Unknown or incomplete launcher option: ${key}. Put Studio arguments after --.`);
    }
    values[key.slice(2)] = options.shift();
  }
  if (!['doctor', 'studio'].includes(command)) throw new Error(`Unknown launcher command: ${command}`);
  if (!['zh-CN', 'en'].includes(values.locale)) throw new Error('Locale must be zh-CN or en.');
  return values;
}

function takeConfig(args) {
  const forwarded = [];
  let config = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config') {
      if (!args[i + 1]) throw new Error('--config requires a file.');
      config = args[++i];
    } else if (args[i].startsWith('--config=')) {
      config = args[i].slice('--config='.length);
      if (!config) throw new Error('--config requires a file.');
    } else {
      forwarded.push(args[i]);
    }
  }
  return {config, forwarded};
}

function inspectProject(project, explicitConfig = null) {
  const projectRoot = fs.realpathSync(path.resolve(project));
  const manifest = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(manifest)) throw new Error(`No package.json in project: ${projectRoot}`);
  const projectRequire = createRequire(manifest);
  const cliManifest = projectRequire.resolve('@remotion/cli/package.json');
  const fromCli = createRequire(cliManifest);
  const studioManifest = fromCli.resolve('@remotion/studio/package.json');
  const version = JSON.parse(fs.readFileSync(studioManifest, 'utf8')).version;
  const versionParts = version.split('.').map(Number);
  const compatibleMajor = versionParts[0] === 4 && (versionParts[1] > 0 || versionParts[2] >= 498);
  let originalConfig = explicitConfig ? path.resolve(projectRoot, explicitConfig) : null;
  if (originalConfig && !fs.existsSync(originalConfig)) throw new Error(`Config does not exist: ${originalConfig}`);
  if (!originalConfig) {
    originalConfig = ['remotion.config.ts', 'remotion.config.js']
      .map((name) => path.join(projectRoot, name)).find((file) => fs.existsSync(file)) ?? null;
  }
  return {
    projectRoot, version, compatibleMajor, originalConfig,
    cli: path.join(path.dirname(cliManifest), 'remotion-cli.js'),
  };
}

function makeOverlay(info, locale, stateRoot = path.join(extensionRoot, 'state')) {
  const key = crypto.createHash('sha256')
    .update(JSON.stringify([info.projectRoot, info.originalConfig, locale])).digest('hex').slice(0, 24);
  const destination = path.join(stateRoot, key, 'remotion.zh.config.js');
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  const literal = (text) => JSON.stringify(text.replaceAll('\\', '/'));
  const code = [
    info.originalConfig ? `import ${literal(info.originalConfig)};` : '',
    'import {createRequire as createZhRequire} from "node:module";',
    `const zhProjectRequire = createZhRequire(${literal(path.join(info.projectRoot, 'package.json'))});`,
    `const zhExtensionRequire = createZhRequire(${literal(path.join(extensionRoot, 'package.json'))});`,
    'const {Config: zhConfig} = zhProjectRequire("@remotion/cli/config");',
    'const {registerStudioLanguage: zhRegister} = zhExtensionRequire("./src/index.cjs");',
    `zhRegister(zhConfig, {locale: ${JSON.stringify(locale)}, projectRoot: ${literal(info.projectRoot)}});`,
    '',
  ].filter((line, index) => line || index > 0).join('\n');
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== code) {
    fs.writeFileSync(destination, code);
  }
  return destination;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (fs.existsSync(path.join(extensionRoot, 'installation.json'))) {
    try {
      const routing = require('./repair-routing.cjs').repairRouting();
      if (routing.denied.length) console.warn('Remotion skill routing could not be repaired; the current launcher remains available.');
    } catch (error) {
      console.warn(`Remotion routing check skipped: ${error.message}`);
    }
  }
  const {config, forwarded} = takeConfig(options.forwarded);
  const info = inspectProject(options.project, config);
  if (options.command === 'doctor') {
    require('../src/translate.cjs');
    const dictionary = require('../locales/zh-CN.json');
    console.log(JSON.stringify({
      ...info, runtimeRoot: extensionRoot, locale: options.locale,
      dictionaryEntries: Object.keys(dictionary).length,
      tested: require('../compatibility.json').testedVersions.includes(info.version),
      modifiesProject: false,
    }, null, 2));
    return;
  }
  const useTranslation = options.locale === 'zh-CN' && info.compatibleMajor;
  const args = ['studio', ...forwarded];
  if (useTranslation) {
    args.push('--config=' + makeOverlay(info, options.locale));
  } else if (config) {
    args.push('--config=' + path.resolve(info.projectRoot, config));
  }
  if (!args.includes('--no-open')) args.push('--no-open');
  console.log(useTranslation
    ? `Remotion 中文扩展：正在为 ${info.version} 加载独立语言包。`
    : `Remotion 中文扩展：正在以原始英文模式启动 ${info.version}。`);
  const child = spawn(process.execPath, [info.cli, ...args], {
    cwd: info.projectRoot, stdio: 'inherit', windowsHide: true,
  });
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`Remotion 中文扩展：${error.message}`); process.exitCode = 1; }
}
module.exports = {parseArguments, takeConfig, inspectProject, makeOverlay};
