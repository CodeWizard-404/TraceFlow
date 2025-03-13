// eslint.config.js
const js = require('@eslint/js');
const pluginImport = require('eslint-plugin-import');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs', // Explicitly set to CommonJS
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      'no-unused-vars': 'warn',
      'import/no-unresolved': 'error',
      'import/order': ['warn', { alphabetize: { order: 'asc' } }],
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.cjs'],
        },
      },
    },
    env: {
      node: true, // Enable Node.js globals like `require`, `module`, `process`, `console`
    },
  },
];