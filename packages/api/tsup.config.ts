import { defineConfig } from "tsup";

// Built to JS (ESM + CJS) like @hagz/contracts, so Metro and Next.js consume it without transpiling
// workspace sources.
export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // tsup sets baseUrl internally when emitting types, which TS 6 flags as deprecated.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  // Not in watch mode: the apps' bundlers would find dist/ deleted mid-rebuild.
  clean: !options.watch,
}));
