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
