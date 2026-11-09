import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "web/**"],
  },
  {
    files: ["packages/dashboard/src/App/assets/workspace/*.js"],
    languageOptions: { globals: Object.fromEntries(["document", "window", "navigator", "location", "innerWidth", "localStorage", "setTimeout", "clearTimeout", "crypto", "URL", "Blob", "fetch", "AbortController", "structuredClone"].map(name => [name, "readonly"])) },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ]
    },
  }
);
