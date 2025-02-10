import js from "@eslint/js";
import node from "eslint-plugin-node";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: ["node_modules/"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: { node },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      eqeqeq: "error",
      "node/no-missing-import": "error",
      "node/no-unpublished-import": "warn",
      "prefer-const": "error",
      "no-var": "error",
      camelcase: "warn",
    },
  },
  prettier,
];
