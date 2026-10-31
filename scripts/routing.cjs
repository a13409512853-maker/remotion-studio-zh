const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const globalStart = '<!-- remotion-studio-zh:start -->';
const globalEnd = '<!-- remotion-studio-zh:end -->';
const skillStart = '<!-- remotion-studio-zh:skill:start -->';
const skillEnd = '<!-- remotion-studio-zh:skill:end -->';
const permissionCodes = new Set(['EACCES', 'EPERM', 'EROFS']);

function locateBlock(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end);
  if (first < 0 && last < 0) return null;
  if (first < 0 || last < first || text.indexOf(start, first + start.length) >= 0 ||
      text.indexOf(end, last + end.length) >= 0) {
    throw new Error('Malformed or duplicate managed routing markers; leaving the file unchanged.');
  }
  return {start: first, end: last + end.length};
}

function removeGlobalRouting(text) {
  const block = locateBlock(text, globalStart, globalEnd);
  return block ? text.slice(0, block.start) + text.slice(block.end) : text;
}

function globalRouting(text, skillPath) {
  const block = [
    globalStart,
    'Remotion Studio Chinese companion (fallback: local skill integration unavailable):',
    `For Remotion Studio previews, read \`${skillPath.replaceAll('\\', '/')}\` and use its launcher unless English is requested.`,
    globalEnd,
  ].join('\n');
  const current = locateBlock(text, globalStart, globalEnd);
  return current
    ? text.slice(0, current.start) + block + text.slice(current.end)
    : text + (text && !text.endsWith('\n') ? '\n' : '') + '\n' + block + '\n';
}

function skillRouting(text, skillPath) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const block = [
    skillStart,
    `For Studio previews, first read [Chinese Studio companion](<${skillPath.replaceAll('\\', '/')}>) and use its launcher in place of the generic Studio command below, unless English is requested.`,
    'Keep the existing entry point, config and bundler flags. Other Remotion workflows continue normally.',
    skillEnd,
  ].join(nl);
  const current = locateBlock(text, skillStart, skillEnd);
  if (current) return text.slice(0, current.start) + block + text.slice(current.end);
  const frontmatter = text.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  const offset = frontmatter ? frontmatter[0].length : 0;
  return text.slice(0, offset) + nl + block + nl + nl + text.slice(offset);
}

function discoverSkills(codexHome, fsApi = fs) {
  const cache = path.join(codexHome, 'plugins/cache');
  if (!fsApi.existsSync(cache)) return [];
  const found = [];
  for (const market of fsApi.readdirSync(cache, {withFileTypes: true})) {
    if (!market.isDirectory()) continue;
    const remotion = path.join(cache, market.name, 'remotion');
    if (!fsApi.existsSync(remotion)) continue;
    for (const version of fsApi.readdirSync(remotion, {withFileTypes: true})) {
      if (!version.isDirectory()) continue;
      const pluginRoot = path.join(remotion, version.name);
      const manifestFile = path.join(pluginRoot, '.codex-plugin/plugin.json');
      if (!fsApi.existsSync(manifestFile)) continue;
      const manifest = JSON.parse(fsApi.readFileSync(manifestFile, 'utf8'));
      if (manifest.name !== 'remotion') continue;
      const root = fsApi.realpathSync(pluginRoot);
      const skills = path.resolve(root, manifest.skills ?? './skills');
      if (!skills.startsWith(root + path.sep)) throw new Error('Plugin skills path escapes its plugin directory.');
      for (const name of ['remotion-best-practices', 'remotion-studio']) {
        for (const filename of ['SKILL.md', 'REFERENCE.md']) {
          const candidate = path.join(skills, name, filename);
          if (fsApi.existsSync(candidate)) {
            const resolved = fsApi.realpathSync(candidate);
            if (!resolved.startsWith(root + path.sep)) throw new Error('Skill symlink escapes its plugin directory.');
            found.push(resolved);
          }
        }
      }
    }
  }
  return [...new Set(found)];
}

function reconcile({codexHome, runtimeRoot, backupRoot, allowGlobalFallback = true, fsApi = fs}) {
  const skillPath = path.join(runtimeRoot, 'plugins/remotion-studio-zh/skills/remotion-studio-zh/SKILL.md');
  if (!fsApi.existsSync(skillPath)) throw new Error('Companion skill is missing.');
  let targets = [];
  const injected = [];
  const denied = [];
  const modified = [];
  try {
    targets = discoverSkills(codexHome, fsApi);
  } catch (error) {
    if (!permissionCodes.has(error.code)) throw error;
    denied.push({file: error.path ?? path.join(codexHome, 'plugins/cache'), code: error.code});
  }

  const write = (file, before, after) => {
    if (before === after) return;
    fsApi.mkdirSync(backupRoot, {recursive: true});
    const key = crypto.createHash('sha256').update(file).digest('hex') + '.md';
    const backup = path.join(backupRoot, key);
    if (!fsApi.existsSync(backup)) fsApi.writeFileSync(backup, before, 'utf8');
    fsApi.writeFileSync(file, after, 'utf8');
    modified.push(file);
  };

  for (const file of targets) {
    try {
      const before = fsApi.readFileSync(file, 'utf8');
      write(file, before, skillRouting(before, skillPath));
      injected.push(file);
    } catch (error) {
      if (!permissionCodes.has(error.code)) throw error;
      denied.push({file, code: error.code});
    }
  }

  const globalFile = path.join(codexHome, 'AGENTS.md');
  const complete = targets.length > 0 && denied.length === 0;
  let mode = complete ? 'remotion-skills' : 'companion-only';
  let globalCleanupPending = false;
  let fallbackDenied = false;
  if (complete || (denied.length > 0 && allowGlobalFallback)) {
    try {
      const before = fsApi.existsSync(globalFile) ? fsApi.readFileSync(globalFile, 'utf8') : '';
      const after = complete ? removeGlobalRouting(before) : globalRouting(before, skillPath);
      write(globalFile, before, after);
      if (!complete) mode = 'global-fallback';
    } catch (error) {
      if (!permissionCodes.has(error.code)) throw error;
      globalCleanupPending = complete;
      fallbackDenied = !complete;
    }
  }
  const result = {
    mode, targets, injected, denied, modified, globalCleanupPending, fallbackDenied,
    missingRemotion: targets.length === 0 && denied.length === 0,
  };
  fsApi.mkdirSync(path.join(runtimeRoot, 'state'), {recursive: true});
  fsApi.writeFileSync(path.join(runtimeRoot, 'state/routing.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

function inspectRouting({codexHome, runtimeRoot}) {
  const targets = discoverSkills(codexHome);
  const skillPath = path.join(runtimeRoot, 'plugins/remotion-studio-zh/skills/remotion-studio-zh/SKILL.md');
  const pending = targets.filter((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return skillRouting(text, skillPath) !== text;
  });
  const globalFile = path.join(codexHome, 'AGENTS.md');
  const globalText = fs.existsSync(globalFile) ? fs.readFileSync(globalFile, 'utf8') : '';
  return {
    mode: targets.length && !pending.length ? 'remotion-skills' :
      locateBlock(globalText, globalStart, globalEnd) ? 'global-fallback' : 'companion-only',
    targets, pending, globalRoutingPresent: Boolean(locateBlock(globalText, globalStart, globalEnd)),
  };
}

module.exports = {globalRouting, removeGlobalRouting, skillRouting, discoverSkills, reconcile, inspectRouting};
