import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI only (migrations). Neon needs its direct, non-pooled URL here; the app itself uses DATABASE_URL.
    // Falls back so `prisma generate` works without a database (e.g. in CI typecheck).
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "postgresql://localhost:5432/hagz",
  },
});
