import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { router } from "@/http/router";
import { env } from "@/platform/config/env";
import { createRouter } from "@/platform/http/router";
import { clientIp, consume, limitByIp, type Limit } from "@/platform/rate-limit/rate-limit";
import { queueConnection } from "@/platform/redis/connections";

// Unique names: Redis is shared by every test worker.
const limitOf = (limit: number, extra: Partial<Limit> = {}): Limit => ({
  name: `test:${randomUUID()}`,
  limit,
  windowMs: 60_000,
  ...extra,
});

const outcome = (attempt: Promise<void>) =>
  attempt.then(
    () => "allowed",
    (error: unknown) => (error as { code: string }).code,
  );

const ipLimit = limitOf(2);
const routes = createRouter();
routes.get("/limited", limitByIp(ipLimit), (c) => c.body(null, 204));
router.route("/test", routes);

afterEach(() => {
  vi.restoreAllMocks();
  env.CLIENT_IP_HEADER = undefined;
});

describe("consume", () => {
  it("allows up to the limit, then rejects with a retry hint", async () => {
    const limit = limitOf(3);

    for (let i = 0; i < 3; i++)
      await expect(consume(limit, "+201001234567")).resolves.toBeUndefined();
    const rejected = consume(limit, "+201001234567");

    await expect(rejected).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    const error = (await rejected.catch((e: unknown) => e)) as {
      extensions: { retryAfter: number };
    };
    expect(error.extensions.retryAfter).toBeGreaterThan(0);
    expect(error.extensions.retryAfter).toBeLessThanOrEqual(60);
  });

  it("counts each value separately", async () => {
    const limit = limitOf(1);

    await consume(limit, "+201001234567");
    await expect(consume(limit, "+201007654321")).resolves.toBeUndefined();
  });

  it("lets exactly the limit through when requests race", async () => {
    const limit = limitOf(10);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => outcome(consume(limit, "racer"))),
    );

    expect(results.filter((r) => r === "allowed")).toHaveLength(10);
    expect(results.filter((r) => r === "RATE_LIMITED")).toHaveLength(40);
  });

  it("starts a new window once the old one expires", async () => {
    const limit = limitOf(1, { windowMs: 300 });
    await consume(limit, "window");
    await expect(consume(limit, "window")).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await new Promise((resolve) => setTimeout(resolve, 400));

    await expect(consume(limit, "window")).resolves.toBeUndefined();
  });

  it("never stores the raw value in Redis", async () => {
    const limit = limitOf(5);
    await consume(limit, "+201001234567");

    const keys = await queueConnection.keys(`ratelimit:${limit.name}:*`);
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("201001234567");
  });
});

describe("when Redis doesn't answer", () => {
  const hang = () =>
    vi.spyOn(queueConnection, "eval").mockReturnValue(new Promise(() => undefined));

  it("fails closed with a 503, quickly, by default", async () => {
    hang();
    const started = performance.now();

    await expect(consume(limitOf(5), "x")).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("fails open when the limit allows it", async () => {
    hang();

    await expect(consume(limitOf(5, { failOpen: true }), "x")).resolves.toBeUndefined();
  });
});

describe("limitByIp", () => {
  it("returns 429 with Retry-After once an IP is over the limit", async () => {
    const call = () => router.request("/test/limited");
    expect((await call()).status).toBe(204);
    expect((await call()).status).toBe(204);

    const res = await call();

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("clientIp", () => {
  const contextWith = (headers: Record<string, string>) =>
    ({ req: { header: (name: string) => headers[name.toLowerCase()] }, env: {} }) as never;

  it("ignores forwarding headers unless one is explicitly trusted", () => {
    expect(clientIp(contextWith({ "x-real-ip": "6.6.6.6" }))).toBe("unknown");
  });

  it("uses the trusted header once configured", () => {
    env.CLIENT_IP_HEADER = "x-real-ip";
    expect(clientIp(contextWith({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });
});
