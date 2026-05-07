import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { HTTPException } from 'hono/http-exception'
import { serve } from '@hono/node-server'
import { ZodError } from 'zod'

import auth from '@/domains/auth/auth.routes.js';
import pitches from '@/domains/pitches/pitches.routes.js';

import AppError from '@/shared/lib/utils/error.js'

const app = new Hono();

// Middleware configuration with logger, secureHeaders and cors.
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
}));

// Handle errors gracefully and globally across the application.
app.onError((err, c) => {
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
});

// Application routing from the root level.
app.route('/auth', auth);
app.route('/pitches', pitches);

// Serve the application and expose from Docker locally.
serve({
  fetch: app.fetch,
  port: 8080,
  hostname: '0.0.0.0'
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
