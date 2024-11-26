-- CreateTable
CREATE TABLE "OwnerToken" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerToken_token_key" ON "OwnerToken"("token");

-- AddForeignKey
ALTER TABLE "OwnerToken" ADD CONSTRAINT "OwnerToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
