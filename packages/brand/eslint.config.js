import base from "@hagz/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(base, {
  languageOptions: {
    parserOptions: { tsconfigRootDir: import.meta.dirname },
  },
});
