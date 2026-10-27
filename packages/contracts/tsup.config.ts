import { defineConfig } from "tsup";

// Built to JS (ESM + CJS) so Expo's app.config.ts can require it.
export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // tsup sets baseUrl internally when emitting types, which TS 6 flags as deprecated.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  // Not in watch mode: `pnpm dev` starts the apps alongside it, and Expo's app.config.ts would find
  // dist/ deleted mid-rebuild. The build that runs before dev has already filled it.
  clean: !options.watch,
}));
