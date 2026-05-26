import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { slotsQueue } from "@/jobs/queues/slots.queue.js";
import { notificationsQueue } from "@/jobs/queues/notifications.queue.js";
import { invitationsQueue } from "@/jobs/queues/invitations.queue.js";
import { bookingsQueue } from "@/jobs/queues/bookings.queue.js";

const serverAdapter = new HonoAdapter(serveStatic);

createBullBoard({
  queues: [
    new BullMQAdapter(slotsQueue),
    new BullMQAdapter(notificationsQueue),
    new BullMQAdapter(invitationsQueue),
    new BullMQAdapter(bookingsQueue),
  ],
  serverAdapter,
});

serverAdapter.setBasePath("/queues");

export { serverAdapter };