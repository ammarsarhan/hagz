import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Falls back so `prisma generate` works without a database (e.g. in CI typecheck).
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/hagz",
  },
});
