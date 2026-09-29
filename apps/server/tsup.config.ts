import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/app.ts", "src/worker.ts"],
  format: ["esm"],
  target: "node24",
  clean: true,
  sourcemap: true,
});
