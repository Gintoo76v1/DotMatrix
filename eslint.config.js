import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'public/scripts/**', 'tests/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      complexity: ['warn', 10],
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
    },
  },
];
