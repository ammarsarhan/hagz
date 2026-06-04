import prisma from "@/shared/lib/utils/prisma.js";
import { Factory } from "hono/factory"

const factory = new Factory();

export const getLocationsHandler = factory.createHandlers(
    async (c) => {
        const governorates = await prisma.governorate.findMany({ include: { areas: true }});
        return c.json({ success: true, data: { governorates }}, 200);
    }
)