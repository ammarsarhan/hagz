import base from "@hagz/eslint-config";
import boundaries from "eslint-plugin-boundaries";
import { defineConfig, globalIgnores } from "eslint/config";

// Architecture rules from docs/architecture.md ("Layout: a modular monolith"):
// - modules reach each other only through index.ts;
// - inside a module, http → application → domain, and domain stays pure;
// - platform is the bottom layer and never imports modules or http.
const layer = (types, captured) => ({ element: { types, captured } });
const sameModule = { module: "{{ from.element.captured.module }}" };
const moduleFiles = ["module", "domain", "application", "endpoints"];
const publicApi = { element: { type: "module", fileInternalPath: "index.ts" } };
const platform = { element: { type: "platform" } };

export default defineConfig(globalIgnores(["src/generated/"]), base, {
  languageOptions: {
    parserOptions: { tsconfigRootDir: import.meta.dirname },
  },
  plugins: { boundaries },
  settings: {
    "boundaries/root-path": import.meta.dirname,
    "boundaries/include": ["src/**/*.ts"],
    "boundaries/legacy-templates": false,
    "import/resolver": {
      typescript: { project: `${import.meta.dirname}/tsconfig.json` },
    },
    // Most specific first: a file belongs to the first descriptor that matches its folder.
    "boundaries/elements": [
      { type: "domain", pattern: "src/modules/*/domain", capture: ["module"] },
      { type: "application", pattern: "src/modules/*/application", capture: ["module"] },
      { type: "endpoints", pattern: "src/modules/*/http", capture: ["module"] },
      { type: "module", pattern: "src/modules/*", capture: ["module"] },
      { type: "platform", pattern: "src/platform/*", capture: ["part"] },
      { type: "http", pattern: "src/http" },
      { type: "generated", pattern: "src/generated" },
      // Anything else under src. Only the process entry points are allowed to import.
      { type: "entry", pattern: "src" },
    ].map((element) => ({ ...element, partialMatch: false })),
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        // Also check packages, so domain/ can be kept free of IO libraries.
        checkAllOrigins: true,
        // The last matching policy wins: broad allows first, narrowing disallows after.
        policies: [
          { allow: { to: { module: { origin: ["external", "core"] } } } },
          {
            from: {
              element: {
                type: "entry",
                fileInternalPath: ["app.ts", "worker.ts", "create-admin.ts"],
              },
            },
            allow: { to: [{ element: { types: ["http", "platform"] } }, publicApi] },
          },
          { from: { element: { type: "http" } }, allow: { to: [platform, publicApi] } },
          {
            from: platform,
            allow: { to: { element: { types: ["platform", "generated"] } } },
          },
          {
            from: layer(moduleFiles),
            allow: { to: [layer(moduleFiles, sameModule), platform, publicApi] },
          },
          { from: layer(["application"]), allow: { to: { element: { type: "generated" } } } },
          {
            from: layer(["domain", "application", "endpoints"]),
            disallow: { to: layer(["module"], sameModule) },
            message: "Import the file directly: this module's index.ts re-exports it.",
          },
          {
            from: layer(["domain"]),
            disallow: {
              to: [
                layer(["application", "endpoints"]),
                { element: { type: "platform", captured: { part: "!errors" } } },
                {
                  module: {
                    origin: "external",
                    source: ["@prisma/*", "pg", "ioredis", "bullmq", "hono", "@hono/*"],
                  },
                },
              ],
            },
            message: "domain/ holds pure functions: no database, Redis, HTTP or platform services.",
          },
          {
            from: layer(["application"]),
            disallow: { to: layer(["endpoints"]) },
            message: "application/ must not depend on http/.",
          },
          {
            from: layer(["endpoints"]),
            disallow: { to: { element: { type: "platform", captured: { part: "db" } } } },
            message: "http/ goes through application/ and never touches the database.",
          },
        ],
      },
    ],
  },
});
