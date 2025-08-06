const babelJest = require('babel-jest').createTransformer();

module.exports = {
  process(src, filename, config, transformOptions) {
    const match = src.match(/```js\s*([\s\S]*?)```/);
    const jsContent = match ? match[1].trim() : '';

    return babelJest.process(jsContent, filename, config, transformOptions);
  },
};
