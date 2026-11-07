import { Problem } from "@hagz/contracts";

// Pieces for writing route definitions (each module's http/definitions/).

// For a route's `responses`: an error that route can return, documented as a Problem.
export const problemResponse = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: Problem } },
});

// A JSON response or request body with this schema.
export const json = <T>(schema: T) => ({ content: { "application/json": { schema } } });

// For a route's `request`: a required JSON body.
export const body = <T>(schema: T) => ({ body: { required: true, ...json(schema) } });
