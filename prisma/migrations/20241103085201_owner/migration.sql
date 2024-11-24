/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `Owner` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Owner` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `Owner` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Owner" ALTER COLUMN "activePaymentMethod" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Owner_id_key" ON "Owner"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_phone_key" ON "Owner"("phone");
