const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const compatibility = require('../compatibility.json');

function findStudio(projectRoot) {
  const requireFromProject = createRequire(path.join(path.resolve(projectRoot), 'package.json'));
  let filename;
  try {
    filename = requireFromProject.resolve('@remotion/studio/package.json');
  } catch {
    const cli = requireFromProject.resolve('@remotion/cli/package.json');
    filename = createRequire(cli).resolve('@remotion/studio/package.json');
  }
  const version = JSON.parse(fs.readFileSync(filename, 'utf8')).version;
  return {root: fs.realpathSync(path.dirname(filename)), version};
}

function withStudioLanguage(config, options = {}) {
  const {locale = 'zh-CN', projectRoot = config.context ?? process.cwd(), dictionary = {}} = options;
  if (locale === 'en') return config;
  if (locale !== 'zh-CN') throw new Error(`Unknown Studio locale: ${locale}`);
  const studio = findStudio(projectRoot);
  if (Number(studio.version.split('.')[0]) !== compatibility.studioMajor) {
    process.emitWarning(`Studio ${studio.version} is unsupported; using the original English interface.`);
    return config;
  }
  if (!compatibility.testedVersions.includes(studio.version)) {
    process.emitWarning(`Studio ${studio.version} has not been tested with this language pack.`);
  }
  const dictionaryFile = require.resolve('../locales/zh-CN.json');
  const translations = {...JSON.parse(fs.readFileSync(dictionaryFile, 'utf8')), ...dictionary};
  for (const [key, value] of Object.entries(translations)) {
    if (typeof value !== 'string') throw new TypeError(`Translation for ${key} must be a string.`);
  }
  const dist = path.join(studio.root, 'dist') + path.sep;
  const rule = {
    test: /\.[cm]?js$/,
    include: (resource) => resource.startsWith(dist),
    enforce: 'pre',
    use: [{
      loader: require.resolve('./loader.cjs'),
      options: {dictionary: translations, dictionaryFile},
    }],
  };
  return {
    ...config,
    module: {...config.module, rules: [...(config.module?.rules ?? []), rule]},
  };
}

function registerStudioLanguage(configApi, options = {}) {
  if (typeof configApi?.overrideBundlerConfig !== 'function') {
    process.emitWarning('Studio translation was not registered: this Remotion configuration API is unsupported.');
    return false;
  }
  configApi.overrideBundlerConfig((config) => withStudioLanguage(config, options));
  return true;
}

module.exports = {withStudioLanguage, registerStudioLanguage};
