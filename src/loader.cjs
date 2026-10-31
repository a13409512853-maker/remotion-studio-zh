const remapping = require('@jridgewell/remapping');
const {translate} = require('./translate.cjs');

module.exports = function studioLanguageLoader(source, inputMap) {
  this.cacheable?.(true);
  const {dictionary, dictionaryFile} = this.getOptions();
  this.addDependency?.(dictionaryFile);
  try {
    const result = translate(String(source), dictionary, this.resourcePath);
    if (!result.count) {
      this.callback(null, source, inputMap);
      return;
    }
    const generated = JSON.parse(result.map.toString());
    const map = inputMap
      ? remapping([generated, typeof inputMap === 'string' ? JSON.parse(inputMap) : inputMap], () => null)
      : generated;
    this.callback(null, result.code, map);
  } catch (error) {
    this.emitWarning(new Error(`Studio translation skipped for ${this.resourcePath}: ${error.message}`));
    this.callback(null, source, inputMap);
  }
};
