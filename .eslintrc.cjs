/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  settings: {
    react: { version: "detect" },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ["out", "dist", "node_modules", ".vite", "coverage", "apps/desktop/out", "apps/desktop/dist"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "react/prop-types": "off",
  },
  overrides: [
    {
      files: ["apps/desktop/src/main/**/*", "apps/desktop/src/preload/**/*"],
      env: { node: true, browser: false },
    },
  ],
};
