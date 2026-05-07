import { Worker } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { InvitationStatus } from "@/generated/prisma/enums.js";
import type { InvitationJobPayload } from "@/shared/types/invitations.js";

new Worker<InvitationJobPayload>("invitations", 
    async (job) => {
        console.log(`[invitations-worker]: Handling expiry on job: ${job.id}`);

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
    { connection: redis.consumer }
);

