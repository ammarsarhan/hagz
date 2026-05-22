import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import { InvitationStatus } from "@/generated/prisma/enums.js";
import type { InvitationJobPayload } from "@/shared/types/invitations.js";

const invitationsWorker = new Worker<InvitationJobPayload>("invitations", 
    async (job) => {
        await prisma.invitation.update({ 
            where: {
                id: job.data.invitationId,
                status: InvitationStatus.PENDING
            },
            data: {
                status: InvitationStatus.EXPIRED
            }
        }) 
    },
    { 
        connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    }
);

// Handle failing and mark for manual resolving.
invitationsWorker.on("failed", async (job, err) => {
    // Removed update function from this block because it's already being done on the worker main block.
    if (!job) return;
    console.error(`[invitations-worker] job ${job.id} (${job.name}) failed for invitation ${job.data.invitationId}:`, err.message);
});