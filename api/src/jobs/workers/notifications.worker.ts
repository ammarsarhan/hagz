import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import sendWhatsapp from "@/shared/lib/providers/whatsapp.js";
import { NotificationChannel, NotificationStatus } from "@/generated/prisma/enums.js";
import type { NotificationsJobPayload } from "@/shared/types/notifications.js";
import { resolveTemplate } from "@/shared/lib/providers/templates.js";
import { sendInApp } from "@/shared/lib/providers/app.js";

const notificationsWorker = new Worker<NotificationsJobPayload>("notifications", 
    async (job) => {
        const { notificationId, deliveryId, event, channel, phone, payload } = job.data;

        // Fetch the delivery to make sure it exists and isn't already sent.
        const delivery = await prisma.notificationDelivery.findUnique({
            where: { id: deliveryId },
        });

        if (!delivery) throw new Error(`Delivery ${deliveryId} not found.`);
        if (delivery.status === NotificationStatus.SENT) return;

        try {
            let providerRef: string | undefined;

            // Dispatch to the right provider.
            switch (channel) {
                case NotificationChannel.WHATSAPP: {
                    const { templateName, variables } = resolveTemplate(event, channel, payload);
                    const result = await sendWhatsapp({ to: phone!, templateName, variables });
                    providerRef = result.messages?.[0]?.id;
                    break;
                }
                case NotificationChannel.IN_APP: {
                    const delivery = await sendInApp(notificationId);
                    providerRef = delivery.id;
                    break;
                }
                case NotificationChannel.EMAIL: {
                    // providerRef = await sendEmail({ ... })
                    break;
                }
                case NotificationChannel.PUSH: {
                    // providerRef = await sendPush({ ... })
                    break;
                }
                default:
                    throw new Error(`Unhandled channel: ${channel}.`);
            }

            // Mark as sent if the delivery succeeds.
            await prisma.notificationDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: NotificationStatus.SENT,
                    providerRef,
                    sentAt: new Date(),
                },
            });
        } catch (err: any) {
            // Mark as failed, then re-throw so BullMQ retries the job.
            await prisma.notificationDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: NotificationStatus.FAILED,
                    error: err.message,
                },
            });

            throw err;
        }
    },
    { 
        connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    }
);

// Handle failing and mark for manual resolving.
notificationsWorker.on("failed", async (job, err) => {
    if (!job) return;
    console.error(job.data);
    console.error(`[notifications-worker] job ${job.id} (${job.name}) failed for notification ${job.data.notificationId}:`, err.message);
});
