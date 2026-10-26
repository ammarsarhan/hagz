import { OpenAPIHono, type Hook } from "@hono/zod-openapi";
import type { Env } from "hono";
import { Problem, type ValidationIssue } from "@hagz/contracts";
import { AppError } from "@/platform/errors/app-error";

// Turns a failed request validation into our problem format instead of a raw ZodError dump.
const rejectInvalid: Hook<unknown, Env, string, unknown> = (result) => {
  if (result.success) return;
  const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
    in: result.target,
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
  throw new AppError({
    code: "VALIDATION_FAILED",
    status: 400,
    detail: "The request is invalid. See `errors` for each problem.",
    extensions: { errors },
  });
};

// Every router (the root and each module's) is created here, so they all validate the same way and
// add their routes to one OpenAPI document.
export const createRouter = () => new OpenAPIHono({ defaultHook: rejectInvalid });

// For a route's `responses`: an error that route can return, documented as a Problem.
export const problemResponse = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: Problem } },
});
