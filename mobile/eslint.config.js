/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './']],
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
    },
    rules: {
      'react/display-name': 'off',
    },
  },
]);
