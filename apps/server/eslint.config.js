import base from "@hagz/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(globalIgnores(["src/generated/"]), base, {
  languageOptions: {
    parserOptions: { tsconfigRootDir: import.meta.dirname },
  },
});
