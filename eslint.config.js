import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["release/", 
      "dist/**",
      "coverage/**",
      "native/**/bin/**",
      "native/**/obj/**",
      "eslint.config.js",
      "scripts/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": ["error", { allow: ["log", "error"] }],
      "prefer-const": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
