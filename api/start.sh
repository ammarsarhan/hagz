#!/bin/sh

# Exit on error
set -e

echo "Starting API startup sequence..."

# 1. Generate Prisma Client
# This ensures the client is always in sync, even if node_modules were shadowed by a volume.
echo "Generating Prisma Client..."
npx prisma generate

# 2. Push Database Schema
# This syncs the schema without needing migrations (good for dev).
echo "Pushing database schema..."
npx prisma db push

# 3. Seed Database
# Our seed script is now idempotent and will skip if data already exists.
echo "Seeding database..."
npx prisma db seed

# 4. Start Development Server
echo "Starting development server..."
npm run dev
