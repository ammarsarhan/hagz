-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension (lets a GiST index compare uuids with =, for exclusion constraints)
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension (trigram indexes, so name search can match part of a word)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateFunction (hand-added: Prisma cannot declare functions)
-- A name folded for search, so every spelling of it compares equal. Mirrored by foldName in
-- src/platform/text/fold.ts, which folds the typed query the same way (a test keeps them equal).
-- NFKD splits accented Latin letters, Arabic hamza and madda forms (أ إ آ ؤ ئ) and presentation forms
-- into a base letter plus marks; the marks, Arabic diacritics, tatweel, apostrophes, dots, hyphens and
-- every kind of space are dropped, including the invisible ones pasted text carries (zero-width and
-- bidi marks), listed by code point so the result doesn't depend on the server's locale. Then ى→ي,
-- ة→ه, and Arabic-Indic digits become 0–9. IMMUTABLE, so indexes can use it; changing it later
-- means a new migration that replaces it and rebuilds every index on it (REINDEX), or they go stale.
CREATE FUNCTION fold_name(name text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN translate(
    regexp_replace(
      normalize(lower(name), NFKD),
      '[\u0300-\u036F\u0640\u064B-\u0655\u0670\u0009-\u000D\u0020\u00A0\u2000-\u200F\u202F\u2019\u205F\u3000\uFEFF''.-]',
      '',
      'g'
    ),
    'ىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    'يه01234567890123456789'
  );
