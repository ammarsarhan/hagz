import prisma from "@/shared/lib/utils/prisma.js";
import { GroundSlotEvent } from "@/shared/types/slots.js";
import { slotsQueue } from "@/jobs/queues/slots.queue.js";
import config from "@/shared/config.js";

export async function scheduleSlotExtension() {
    const grounds = await prisma.ground.findMany({
        select: { 
            id: true, 
            pitchId: true,
        },
        where: {
            pitch: {
                status: { in: config.ACTIVE_STATES }
            }
        }
    });

    for (const ground of grounds) {
        await slotsQueue.add(
            "extend",
            {
                event: GroundSlotEvent.EXTEND,
                groundId: ground.id,
                pitchId: ground.pitchId,
            },
            {
                repeat: {
                    // This job needs to run at midnight UTC every day.
                    pattern: "0 0 * * *",
                },
                // Delete duplicates across restarts.
                jobId: `slots-${ground.id}-extend`,
            }
        );
    }
}