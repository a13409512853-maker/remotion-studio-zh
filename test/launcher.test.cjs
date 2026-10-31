const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parseArguments, takeConfig, inspectProject, makeOverlay} = require('../scripts/launch.cjs');
const {updateRouting} = require('../scripts/install-local.cjs');

test('launcher preserves entrypoint and Studio options as separate arguments', () => {
  const options = parseArguments(['studio', '--project', 'C:/视频 工程', '--', 'src/index.ts', '--rspack', '--port=3458']);
  assert.equal(options.project, 'C:/视频 工程');
  assert.deepEqual(options.forwarded, ['src/index.ts', '--rspack', '--port=3458']);
  assert.throws(() => parseArguments(['studio', '--port=3458']), /after --/);
});

test('explicit user config is retained independently of the injected config', () => {
  assert.deepEqual(takeConfig(['src/index.ts', '--config', 'custom.ts', '--rspack']), {
    config: 'custom.ts', forwarded: ['src/index.ts', '--rspack'],
  });
  assert.throws(() => takeConfig(['--config']), /requires/);
});

test('global routing is idempotent and preserves other user instructions', () => {
  const original = '用户要求：保留原有工作方式。\n';
  const once = updateRouting(original, 'C:/Tools/skill/SKILL.md');
  assert.ok(once.startsWith(original));
  assert.equal(updateRouting(once, 'C:/Tools/skill/SKILL.md'), once);
  const revised = updateRouting(once, 'C:/Tools/new/SKILL.md');
  assert.ok(revised.startsWith(original));
  assert.equal(revised.includes('C:/Tools/skill/SKILL.md'), false);
});

test('generated overlay reads the original config without rewriting it', () => {
  const scratch = path.resolve(__dirname, '../state/unit-fixture');
  fs.mkdirSync(scratch, {recursive: true});
  const config = path.join(scratch, 'original.ts');
  fs.writeFileSync(config, 'export const original = true;\n');
  const before = fs.readFileSync(config, 'utf8');
  const result = makeOverlay({projectRoot: scratch, originalConfig: config}, 'zh-CN', path.join(scratch, 'cache'));
  const source = fs.readFileSync(result, 'utf8');
  assert.ok(source.includes(JSON.stringify(config.replaceAll('\\', '/'))));
  assert.ok(source.includes('registerStudioLanguage'));
  assert.equal(fs.readFileSync(config, 'utf8'), before);
  assert.equal(makeOverlay({projectRoot: scratch, originalConfig: config}, 'zh-CN', path.join(scratch, 'cache')), result);
});

test('project inspection refuses to treat a random directory as a Remotion project', () => {
  assert.throws(() => inspectProject(__dirname), /No package.json/);
});
