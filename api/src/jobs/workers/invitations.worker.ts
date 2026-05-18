import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import { InvitationStatus } from "@/generated/prisma/enums.js";
import type { InvitationJobPayload } from "@/shared/types/invitations.js";

new Worker<InvitationJobPayload>("invitations", 
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

