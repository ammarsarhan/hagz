import { Hono } from "hono";
import auth from "@/domains/auth/auth.routes.js";
import { serverAdapter } from "@/internal/bullboard.js";
import { redis } from "@/shared/lib/utils/redis.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { fetchLocationsHandler } from "@/domains/pitches/handlers/locations.handlers.js";

const app = new Hono()
    .route('/auth', auth)
    .route("/queues", serverAdapter.registerPlugin())
    .get('/locations', ...fetchLocationsHandler)
    .get('/health', 
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