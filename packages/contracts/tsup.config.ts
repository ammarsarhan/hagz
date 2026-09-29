import { defineConfig } from "tsup";

// Built to JS (ESM + CJS) so Expo's app.config.ts can require it.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // tsup sets baseUrl internally when emitting types, which TS 6 flags as deprecated.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
});
