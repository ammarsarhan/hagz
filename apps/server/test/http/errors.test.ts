import { createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { AppError } from "@/platform/errors/app-error";
import { createRouter } from "@/platform/http/router";

// Throwaway routes on the real router, so the real middleware and error handler run.
const routes = createRouter().openapi(
  createRoute({
    method: "post",
    path: "/things",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ name: z.string().min(1), count: z.int().positive() }),
          },
        },
      },
    },
    responses: { 204: { description: "ok" } },
  }),
  (c) => c.body(null, 204),
);
routes.get("/app-error", () => {
  throw new AppError({
    code: "SLOT_UNAVAILABLE",
    status: 409,
    detail: "Taken.",
    extensions: { slotIds: ["a"], status: 200, code: "HIJACK" },
  });
});
routes.get("/bug", () => {
  throw new Error("password=hunter2");
});
routes.get("/overloaded", () => {
  throw new HTTPException(503, { message: "pool exhausted at 10.0.0.3" });
});
router.route("/test", routes);

const problemOf = async (res: Response) => {
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  return (await res.json()) as Record<string, unknown>;
};

describe("errors", () => {
  it("answers an unknown route with a 404 problem carrying the request id", async () => {
    const res = await router.request("/v1/nope", { headers: { "X-Request-Id": "trace-123" } });

    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBe("trace-123");
    expect(await problemOf(res)).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "NOT_FOUND",
      detail: "No route for GET /v1/nope.",
      requestId: "trace-123",
    });
  });

  it("returns an AppError's status, code and extensions, which can't overwrite the standard members", async () => {
    const res = await router.request("/test/app-error");

    expect(res.status).toBe(409);
    expect(await problemOf(res)).toMatchObject({
      status: 409,
      code: "SLOT_UNAVAILABLE",
      slotIds: ["a"],
    });
  });

  it("hides the details of an unexpected error", async () => {
    const res = await router.request("/test/bug");

    expect(res.status).toBe(500);
    const problem = await problemOf(res);
    expect(problem.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(problem)).not.toContain("hunter2");
  });

  it("keeps a 5xx HTTPException's status but not its message", async () => {
    const res = await router.request("/test/overloaded");

    expect(res.status).toBe(503);
    const problem = await problemOf(res);
    expect(problem.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(problem)).not.toContain("10.0.0.3");
  });

  it("lists every invalid field", async () => {
    const res = await router.request("/test/things", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "", count: -1 }),
    });

    expect(res.status).toBe(400);
    const problem = await problemOf(res);
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.errors).toEqual([
      expect.objectContaining({ in: "json", path: "name", code: "too_small" }),
      expect.objectContaining({ in: "json", path: "count", code: "too_small" }),
    ]);
  });

  it("rejects malformed JSON with a 400, not a 500", async () => {
    const res = await router.request("/test/things", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });

    expect(res.status).toBe(400);
    expect((await problemOf(res)).code).toBe("BAD_REQUEST");
  });

  it("rejects bodies over 100 KB", async () => {
    const res = await router.request("/test/things", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(101 * 1024), count: 1 }),
    });

    expect(res.status).toBe(413);
    expect((await problemOf(res)).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("replaces an unsafe client request id", async () => {
    const res = await router.request("/v1/nope", { headers: { "X-Request-Id": "bad id<script>" } });

    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
