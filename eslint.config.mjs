import pluginTs from '@typescript-eslint/eslint-plugin';
import parserTs from '@typescript-eslint/parser';
import pluginPrettier from 'eslint-plugin-prettier';
import prettierConfig from './prettier.config.js';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': pluginTs,
      prettier: pluginPrettier
    },
    rules: {
      ...pluginTs.configs.recommended.rules,
      'prettier/prettier': ['error', prettierConfig],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'prefer-template': 'error',
      'space-infix-ops': 'error',
      'comma-spacing': ['error', { before: false, after: true }],
      curly: ['error', 'all'],
      indent: ['error', 2, { SwitchCase: 1 }]
    }
  }
];
