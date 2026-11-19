import type { Clock } from "@/platform/clock/clock";
import type { Tx } from "@/platform/db/transaction";
import type { NotificationData, NotificationType } from "../domain/types";

export type StaffNotification = {
  [T in NotificationType]: { staffId: string; venueId: string; type: T; data: NotificationData[T] };
}[NotificationType];

// Records notifications in the caller's transaction, so they exist exactly when the change they
// describe does. The row is the in-app notification; a PENDING push delivery is the intent the
// notification worker (Phase 6) sends from. Nothing is sent from here.
export const notifyStaff = async (tx: Tx, notifications: StaffNotification[], clock: Clock) => {
  const now = clock.now();
  for (const { staffId, venueId, type, data } of notifications) {
    await tx.notification.create({
      data: {
        staffId,
        venueId,
        type,
        data,
        deliveries: { create: { channel: "PUSH", nextAttemptAt: now } },
      },
    });
  }
};

export type AdminNotification = {
  [T in NotificationType]: { adminId: string; venueId: string; type: T; data: NotificationData[T] };
}[NotificationType];

// Admins read notifications in the admin web, which has no push channel yet, so these are in-app
// only: the row is the notification, with no deliveries to send.
export const notifyAdmins = async (tx: Tx, notifications: AdminNotification[]) => {
  for (const { adminId, venueId, type, data } of notifications) {
    await tx.notification.create({ data: { adminId, venueId, type, data } });
  }
};

// Takes back the notifications of a type about one thing (an invitation whose message never went),
// in the caller's transaction, with their deliveries: as if they'd never been made. `about` is the
// data field naming the thing, and its value.
export const withdrawNotifications = async (
  tx: Tx,
  type: NotificationType,
  about: { field: string; equals: string },
) => {
  await tx.notification.deleteMany({
    where: { type, data: { path: [about.field], equals: about.equals } },
  });
};
