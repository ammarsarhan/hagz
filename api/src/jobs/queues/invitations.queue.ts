import { Queue } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import type { InvitationJobPayload } from "@/shared/types/invitations.js";

export const invitationsQueue = new Queue<InvitationJobPayload>("invitations", {
    connection: redis.producer
});
