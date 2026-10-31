const {parse} = require('acorn');
const {simple} = require('acorn-walk');
const MagicString = require('magic-string');

const uiProperties = new Set([
  'children', 'label', 'title', 'placeholder', 'tooltip', 'text',
  'description', 'header', 'buttonLabel', 'quickSwitcherLabel',
  'defaultLabel', 'aria-label', 'ariaLabel',
]);

function translate(source, dictionary, filename = 'studio.js') {
  const ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'});
  const output = new MagicString(source);
  const changed = new Set();
  const missing = new Set();

  const visitUiValue = (node) => {
    if (!node) return;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      if (!Object.hasOwn(dictionary, node.value)) {
        if (node.value.trim()) missing.add(node.value);
        return;
      }
      const value = dictionary[node.value];
      if (typeof value !== 'string') throw new TypeError('Translation values must be strings.');
      if (node.value !== value && !changed.has(node.start)) {
        output.overwrite(node.start, node.end, JSON.stringify(value));
        changed.add(node.start);
      }
    } else if (node.type === 'ConditionalExpression') {
      visitUiValue(node.consequent);
      visitUiValue(node.alternate);
    } else if (node.type === 'ArrayExpression') {
      for (const element of node.elements) visitUiValue(element);
    }
  };

  simple(ast, {
    Property(node) {
      if (node.computed || node.shorthand || node.kind !== 'init') return;
      const key = node.key.name ?? node.key.value;
      if (uiProperties.has(key)) visitUiValue(node.value);
    },
  });

  return {
    code: output.toString(),
    map: changed.size ? output.generateMap({hires: true, source: filename, includeContent: true}) : null,
    count: changed.size,
    missing: [...missing].sort(),
  };
}

module.exports = {translate};
