/*
  Warnings:

  - You are about to drop the column `policy` on the `Pitch` table. All the data in the column will be lost.
  - Added the required column `settings` to the `Pitch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pitch" DROP COLUMN "policy",
ADD COLUMN     "settings" JSONB NOT NULL;
