import { z } from "zod";

// Every error response (RFC 9457). Clients switch on `code`, never on `detail`.
export const Problem = z
  .looseObject({
    type: z.string(),
    title: z.string(),
    status: z.int(),
    code: z.string().meta({ example: "VALIDATION_FAILED" }),
    detail: z.string(),
    requestId: z.string().optional().meta({ description: "Quote it to support." }),
  })
  .meta({ id: "Problem", description: "An error. Extra members depend on the code." });

export type Problem = z.infer<typeof Problem>;

export const ValidationIssue = z
  .object({
    in: z.enum(["json", "query", "param", "header", "cookie", "form"]),
    path: z.string().meta({ example: "startsAt.0" }),
    code: z.string().meta({ example: "too_small" }),
    message: z.string(),
  })
  .meta({ id: "ValidationIssue" });

export type ValidationIssue = z.infer<typeof ValidationIssue>;
