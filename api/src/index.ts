import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { HTTPException } from 'hono/http-exception'
import { serve } from '@hono/node-server'
import { ZodError } from 'zod'

import root from "@/root.js";
import app from '@/app.js';
import dashboard from '@/dashboard.js';

import AppError from '@/shared/lib/utils/error.js'
import { scheduleSlotExtension } from './internal/extend.js'

const server = new Hono()
  .use('*', logger())
  .use('*', secureHeaders())
  .use('*', cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }))
  .onError((err, c) => {
    // Handle the AppErrors we throw throughout the application's logic.
    if (err instanceof AppError) {
      return c.json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      }, err.statusCode);
    }

    // Handle the validation errors that we have on each validatable route.
    if (err instanceof HTTPException) {
      const cause = err.cause;

      // Unpack the error and parse it into a formattable form on the frontend.
      if (cause instanceof ZodError) {
        return c.json({
          success: false,
          error: {
            message: "Validation failed",
            fields: cause.issues.map(i => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
        }, 400);
      };

      return c.json({
        success: false,
        error: {
          message: err.message,
        },
      }, err.status);
    }

    // If neither this nor that, return an internal server error.
    console.error("Unhandled error:", err);
    
    return c.json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    }, 500);
  })
  .route('/', root)
  .route('/app', app)
  .route('/dashboard', dashboard);

// Serve the application and expose from Docker locally.
serve({
  fetch: server.fetch,
  port: 8080,
  hostname: '0.0.0.0'
}, async (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
  await scheduleSlotExtension();
  console.log(`[slots-worker] Extend jobs scheduled for all grounds.`);
});

export type AppType = typeof server;
export default server;
