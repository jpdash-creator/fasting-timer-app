module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'dist-web/',
    'web-build/',
    'coverage/',
  ],
  rules: {
    // The UI deliberately builds styles from theme tokens inline.
    'react-native/no-inline-styles': 'off',
    // `void promise` is the project convention for fire-and-forget calls.
    'no-void': 'off',
    // Colour maths uses bit operations.
    'no-bitwise': 'off',
  },
  overrides: [
    {
      // Node scripts (asset generation, license audit, checks) and the browser-side axe harness.
      files: ['scripts/**/*.{js,mjs,ts}', 'vite.config.mts', '*.config.js'],
      env: { node: true, browser: true },
      globals: { axe: 'readonly' },
    },
    {
      // Playwright/axe helper kept as a toolbox: unused helpers are intentional.
      files: ['scripts/axe-harness.js'],
      rules: { 'no-unused-vars': 'off' },
    },
    {
      files: ['*.mjs'],
      parserOptions: { sourceType: 'module', ecmaVersion: 'latest' },
    },
    {
      files: ['*.mts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      parserOptions: { sourceType: 'module' },
    },
  ],
};
