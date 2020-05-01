module.exports = {
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: "module",
  },
  env: {
    'es6': true,
    'node': true,
    'mocha': true
  },
  extends: 'eslint:recommended',
  rules: {
    indent: [
      'error',
      2
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    quotes: [
      'error',
      'single'
    ],
    semi: [
      'error',
      'always'
    ],
    "no-func-assign": "warn"
  }
};