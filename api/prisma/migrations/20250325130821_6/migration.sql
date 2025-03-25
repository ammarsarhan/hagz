/*
  Warnings:

  - You are about to drop the column `price` on the `Pitch` table. All the data in the column will be lost.
  - Added the required column `price` to the `Ground` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ground" ADD COLUMN     "price" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "Pitch" DROP COLUMN "price";
