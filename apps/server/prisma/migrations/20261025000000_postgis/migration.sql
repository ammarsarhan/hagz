-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension (lets a GiST index compare uuids with =, for exclusion constraints)
CREATE EXTENSION IF NOT EXISTS "btree_gist";
