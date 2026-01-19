import { Worker } from "bullmq";
import prisma from "@/utils/prisma";
import redis from "@/utils/redis";

(async () => {
    const worker = new Worker("booking", async (job) => {
        switch (job.name) {
            case "approval":
                // If the booking requires approval and the approvalDeadline has been hit before being approved, then reject it.
                await prisma.booking.update({ 
                    where: { id: job.data.id, status: "UNAPPROVED" },
                    data: { status: "REJECTED" }
                });

                break;
            case "payment":
                // If the booking has been unpaid yet and the paymentDeadline has been hit, expire the booking.
                // In this case unpaid means that isPaid is false and paymentMethod is not cash.
                await prisma.booking.update({
                    where: { 
                        id: job.data.id, 
                        isPaid: false, 
                        paymentMethod: { not: "CASH" } 
                    },
                    data: {
                        status: "EXPIRED"
                    }
                });

                break;
            case "start":
                {
                    // If the booking startDate has been hit, only update the booking to IN_PROGRESS if it's been confirmed already.
                    // If it has not been confirmed, set it to expired.
                    await prisma.$transaction(async (tx) => {
                        const booking = await tx.booking.findUnique({ 
                            where: { id: job.data.id }, 
                            select: { id: true, status: true } 
                        });

                        if (!booking) throw new Error("Could not find booking with the specified ID.");

                        if (booking.status === "CONFIRMED") {
                            await tx.booking.update({ where: { id: booking.id }, data: { status: "IN_PROGRESS" } });
                            return;
                        };

                        await tx.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
                        return;
                    });
                };

                break;
            case "end":
                // If the booking has been completed (the endDate has been hit), update it to COMPLETED.
                await prisma.booking.update({
                    where: { id: job.data.id },
                    data: {
                        status: "COMPLETED"
                    }
                });
                
                break;
        }
    }, { connection: redis });

    worker.on("completed", (job) => console.log(`Successfully updated ${job.data.id}.`))
    worker.on("error", (error) => console.log(`An error has occurred while updating. ${error.message}`))
})()
