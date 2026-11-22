import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Each table belongs to one module, and only that module writes it or locks its rows
// (docs/architecture.md, "Modules talk through each other's public index.ts, never through each
// other's tables"). eslint-plugin-boundaries checks imports; it can't see which table a query
// touches, so this reads the source: Prisma writes (`tx.staff.update`, nested `staff: { update }`)
// and raw SQL that inserts, updates, deletes or locks (`FOR UPDATE`). Platform code touches no
// module's tables at all, reads included. Reads across modules are allowed.
//
// A table's owner is its schema file's. A table with no owner yet (bookings, payments, …) can't be
// touched until its module exists and is added here.

const SERVER = join(import.meta.dirname, "../..");
const SCHEMA = join(SERVER, "prisma/schema");
const SRC = join(SERVER, "src");

const FILE_OWNERS: Record<string, string> = {
  "admin.prisma": "identity",
  "customer.prisma": "identity",
  "staff.prisma": "identity",
  "location.prisma": "locations",
  "amenity.prisma": "locations",
  "notification.prisma": "notifications",
  "venue.prisma": "venues",
  "ground.prisma": "venues",
  "layout.prisma": "venues",
  "booking.prisma": "bookings",
};

// Crossings that exist today, each with why it's allowed until it's fixed. An entry that no longer
// matches anything fails too, so the list only shrinks.
const KNOWN: { file: string; table: string; why: string }[] = [];

const WRITES = [
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
];
const NESTED_WRITES = [...WRITES, "connectOrCreate"];

interface Table {
  owner: string | undefined;
  // Relation fields to other tables.
  relations: Map<string, string>;
}

const readSchema = () => {
  const bodies = new Map<string, string>();
  const tables = new Map<string, Table>();
  for (const file of readdirSync(SCHEMA).filter((name) => name.endsWith(".prisma"))) {
    const text = readFileSync(join(SCHEMA, file), "utf8");
    for (const [, name = "", body = ""] of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      bodies.set(name, body);
      tables.set(name, { owner: FILE_OWNERS[file], relations: new Map() });
    }
  }
  for (const [name, table] of tables) {
    for (const [, field = "", type = ""] of (bodies.get(name) ?? "").matchAll(
      /^\s+(\w+)\s+(\w+)/gm,
    )) {
      if (tables.has(type)) table.relations.set(field, type);
    }
  }
  return tables;
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourceFiles(path);
    return name.endsWith(".ts") ? [path] : [];
  });

interface Violation {
  file: string;
  table: string;
  what: string;
}

const findViolations = () => {
  const tables = readSchema();
  const camel = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
  const byClient = new Map([...tables.keys()].map((name) => [camel(name), name]));
  const violations: Violation[] = [];

  // Modules, and platform, which may touch none. Scripts (seeds, create-admin) and the
  // composition root are left alone.
  const scopes = [
    ...readdirSync(join(SRC, "modules")).map((module) => ({
      module,
      files: sourceFiles(join(SRC, "modules", module)),
    })),
    { module: "platform", files: sourceFiles(join(SRC, "platform")) },
  ];

  for (const { module, files } of scopes) {
    const foreign = (table: string) => module === "platform" || tables.get(table)?.owner !== module;
    // Relation fields from this module's tables to tables it doesn't own, for nested writes.
    const foreignFields = new Map<string, string>();
    for (const table of tables.values()) {
      if (table.owner !== module) continue;
      for (const [field, target] of table.relations) {
        if (foreign(target)) foreignFields.set(field, target);
      }
    }

    for (const path of files) {
      const file = relative(SERVER, path);
      const text = readFileSync(path, "utf8");
      const flag = (table: string, what: string) => violations.push({ file, table, what });

      for (const [, client = "", op = ""] of text.matchAll(/\.(\w+)\.(\w+)\(/g)) {
        const table = byClient.get(client);
        if (!table || !foreign(table)) continue;
        if (module === "platform") flag(table, `reads or writes it (${op})`);
        else if (WRITES.includes(op)) flag(table, `writes it (${op})`);
      }

      if (module !== "platform") {
        const nested = new RegExp(
          `\\b(${[...foreignFields.keys()].join("|") || "(?!)"})\\s*:\\s*\\{\\s*(${NESTED_WRITES.join("|")})\\b`,
          "g",
        );
        for (const [, field = "", op = ""] of text.matchAll(nested)) {
          flag(
            foreignFields.get(field) ?? field,
            `writes it through a relation (${field}: { ${op} })`,
          );
        }
      }

      // Raw SQL: the template after $queryRaw, $executeRaw or Prisma.sql.
      for (const [, , sql = ""] of text.matchAll(
        /(\$queryRaw|\$executeRaw|Prisma\.sql)(?:<[^`]*?>)?`([^`]*)`/g,
      )) {
        for (const [, table = ""] of sql.matchAll(/"(\w+)"/g)) {
          if (!tables.has(table) || !foreign(table)) continue;
          if (module === "platform") flag(table, "reads or writes it in SQL");
          else if (new RegExp(`\\b(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+"${table}"`).test(sql))
            flag(table, "writes it in SQL");
          else if (/\bFOR\s+(UPDATE|NO KEY UPDATE|SHARE)\b/.test(sql) && locks(sql, table))
            flag(table, "locks its rows in SQL");
        }
      }
    }
  }
  return violations;
};

// Whether a SELECT … FOR UPDATE locks this table: every table it reads, unless `FOR UPDATE OF`
// names only others (by alias).
const locks = (sql: string, table: string) => {
  const of = /\bFOR\s+(?:UPDATE|NO KEY UPDATE|SHARE)\s+OF\s+([\w\s,]+)/.exec(sql)?.[1];
  if (!of) return true;
  const alias = new RegExp(`"${table}"\\s+(?:AS\\s+)?(\\w+)`).exec(sql)?.[1] ?? table;
  return of
    .split(",")
    .map((name) => name.trim())
    .includes(alias);
};

describe("table ownership", () => {
  const violations = findViolations();
  const known = (v: Violation) => KNOWN.some((k) => k.file === v.file && k.table === v.table);

  it("lets only a table's module write or lock it, and platform touch none", () => {
    expect(
      violations
        .filter((v) => !known(v))
        .map((v) => `${v.file}: ${v.what} on ${v.table}, owned by another module or none`),
    ).toEqual([]);
  });

  it("keeps no exception that no longer happens", () => {
    expect(
      KNOWN.filter((k) => !violations.some((v) => v.file === k.file && v.table === k.table)),
    ).toEqual([]);
  });
});
