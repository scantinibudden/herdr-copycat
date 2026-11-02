// Strict on purpose: every recommended rule from ESLint, eslint-plugin-n (Node) and
// eslint-plugin-unicorn, plus extra core rules that catch real bugs. Each rule
// turned off below says why.
import js from '@eslint/js';
import n from 'eslint-plugin-n';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  n.configs['flat/recommended-module'],
  unicorn.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'array-callback-return': 'error',
      'consistent-return': 'error',
      curly: ['error', 'multi-line'],
      'default-case-last': 'error',
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-return-assign': 'error',
      'no-shadow': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-use-before-define': ['error', { functions: false }],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      // herdr's JSON uses null for "absent", and so do the space files that mirror
      // it; undefined would drop those fields from the saved JSON entirely.
      'unicorn/no-null': 'off',
    },
  },
  {
    // The fake herdr runs as an executable (tests point HERDR_BIN_PATH at it).
    files: ['test/fixtures/fake-herdr.js'],
    rules: { 'n/hashbang': 'off' },
  },
  {
    // Setting the environment before the libs load is this file's whole job.
    files: ['test/helpers.js'],
    rules: { 'unicorn/no-top-level-side-effects': 'off' },
  },
];
