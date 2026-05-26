import prisma from "@/shared/lib/utils/prisma.js";

export async function sendInApp(notificationId: string) {
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
    });

    if (!notification) throw new Error(`Notification ${notificationId} not found.`);

    return { id: notificationId };
}