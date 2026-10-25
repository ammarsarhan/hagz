-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "customerId" UUID,
    "staffId" UUID,
    "adminId" UUID,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "bookingId" UUID,
    "venueId" UUID,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerReference" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "nextAttemptAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_customerId_createdAt_idx" ON "Notification"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_staffId_createdAt_idx" ON "Notification"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_adminId_createdAt_idx" ON "Notification"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_provider_providerReference_key" ON "NotificationDelivery"("provider", "providerReference");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_check" CHECK (num_nonnulls("customerId", "staffId", "adminId") = 1);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_attempts_check" CHECK ("attempts" >= 0);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_sent_check" CHECK (CASE "status" WHEN 'PENDING' THEN "sentAt" IS NULL WHEN 'FAILED' THEN true ELSE "sentAt" IS NOT NULL END);

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_delivered_check" CHECK (("status" = 'DELIVERED') = ("deliveredAt" IS NOT NULL));

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_order_check" CHECK ("deliveredAt" IS NULL OR "deliveredAt" >= "sentAt");

-- AddCheck (hand-added: Prisma cannot declare CHECK constraints)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_retry_check" CHECK ("nextAttemptAt" IS NULL OR status = 'PENDING');
