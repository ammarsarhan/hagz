import { Hono } from "hono";
import auth from "@/domains/auth/auth.routes.js";
import { serverAdapter } from "@/internal/bullboard.js";
import { redis } from "@/shared/lib/utils/redis.js";
import prisma from "@/shared/lib/utils/prisma.js";

const app = new Hono();

app.route('/auth', auth);
app.route("/queues", serverAdapter.registerPlugin());

app.get('/health', 
    async (c) => {
        // Check database is up and running.
        await prisma.$queryRaw`SELECT 1`;

        // Check Redis is up and running.
        await redis.ping();

        return c.json({
            success: true,
            data: {
                status: 'ok',
                database: 'connected',
                cache: 'connected',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            },
        }, 200);
    }
);

export default app;
export type AppType = typeof app;