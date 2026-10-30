import { describe, expect, it, vi } from "vitest";
import { createApiClient, type SessionStore, type StoredSession } from "../src";

const BASE = "https://api.test";

const json = (status: number, body: unknown, type = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": type } });

const problem = (status: number, code: string) =>
  json(
    status,
    { type: "about:blank", title: "", status, code, detail: "" },
    "application/problem+json",
  );

const memoryStore = (initial: StoredSession | null = null) => {
  let value = initial;
  const store: SessionStore = {
    load: vi.fn(() => Promise.resolve(value)),
    save: vi.fn((session: StoredSession) => {
      value = session;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      value = null;
      return Promise.resolve();
    }),
  };
  return { store, current: () => value };
};

// A fake API: access tokens listed in `valid` are accepted; refreshing swaps old for new.
const fakeApi = (handlers: { refresh?: (request: Request) => Promise<Response> } = {}) => {
  let valid = new Set(["access-1"]);
  let refreshes = 0;
  const requests: Request[] = [];
  const fetch = vi.fn(async (request: Request) => {
    requests.push(request.clone());
    const path = new URL(request.url).pathname;
    if (path.endsWith("/sessions/refresh")) {
      refreshes += 1;
      if (handlers.refresh) return handlers.refresh(request);
      const body = (await request.json()) as { refreshToken: string };
      if (body.refreshToken !== "refresh-1") return problem(401, "SESSION_ENDED");
      valid = new Set(["access-2"]);
      return json(200, {
        accessToken: "access-2",
        accessTokenExpiresIn: 600,
        refreshToken: "refresh-2",
        refreshTokenExpiresIn: 5_184_000,
      });
    }
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return problem(401, "UNAUTHENTICATED");
    if (!valid.has(token)) return problem(401, "TOKEN_EXPIRED");
    if (request.method === "PUT") return json(200, await request.json());
    return json(200, { ok: true });
  });
  return {
    fetch,
    requests,
    refreshes: () => refreshes,
    expire: () => (valid = new Set()),
  };
};

const signedIn = { accessToken: "access-1", refreshToken: "refresh-1" };

describe("createApiClient", () => {
  it("sends the access token, language and app version", async () => {
    const server = fakeApi();
    const { api } = createApiClient({
      baseUrl: BASE,
      audience: "customer",
      store: memoryStore(signedIn).store,
      language: () => "en",
      app: { name: "customer", version: "1.2.3" },
      fetch: server.fetch,
    });

    await api.GET("/v1/staff/venues");

    const sent = server.requests[0];
    expect(sent?.headers.get("Authorization")).toBe("Bearer access-1");
    expect(sent?.headers.get("Accept-Language")).toBe("en");
    expect(sent?.headers.get("X-App")).toBe("customer");
    expect(sent?.headers.get("X-App-Version")).toBe("1.2.3");
  });

  it("refreshes an expired token and retries the request with its body", async () => {
    const server = fakeApi();
    server.expire();
    const { store, current } = memoryStore(signedIn);
    const { api } = createApiClient({
      baseUrl: BASE,
      audience: "staff",
      store,
      fetch: server.fetch,
    });

    // Expired until the refresh hands out access-2.
    const { data } = await api.PUT("/v1/auth/staff/two-factor", {
      body: { enabled: true, code: "482913" },
    });

    expect(server.refreshes()).toBe(1);
    expect(data).toEqual({ enabled: true, code: "482913" });
    expect(current()).toEqual({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(server.requests.at(-1)?.headers.get("Authorization")).toBe("Bearer access-2");
  });

  it("refreshes once for many requests that expire together", async () => {
    const server = fakeApi();
    server.expire();
    const { api } = createApiClient({
      baseUrl: BASE,
      audience: "staff",
      store: memoryStore(signedIn).store,
      fetch: server.fetch,
    });

    const results = await Promise.all(Array.from({ length: 5 }, () => api.GET("/v1/staff/venues")));

    expect(server.refreshes()).toBe(1);
    expect(results.every((result) => result.response.ok)).toBe(true);
  });

  it("doesn't refresh again for a request that expired before another refresh finished", async () => {
    const server = fakeApi();
    server.expire();
    const { api } = createApiClient({
      baseUrl: BASE,
      audience: "staff",
      store: memoryStore(signedIn).store,
      fetch: server.fetch,
    });

    await api.GET("/v1/staff/venues");
    await api.GET("/v1/staff/venues");

    expect(server.refreshes()).toBe(1);
  });

  it("ends the session when the refresh token is rejected", async () => {
    const server = fakeApi();
    server.expire();
    const { store, current } = memoryStore({ accessToken: "access-1", refreshToken: "stolen" });
    const onSessionEnded = vi.fn();
    const { api, auth } = createApiClient({
      baseUrl: BASE,
      audience: "customer",
      store,
      onSessionEnded,
      fetch: server.fetch,
    });

    const [first, second] = await Promise.all([
      api.GET("/v1/staff/venues"),
      api.GET("/v1/staff/venues"),
    ]);

    expect(first.error).toMatchObject({ code: "SESSION_ENDED" });
    expect(second.error).toMatchObject({ code: "SESSION_ENDED" });
    expect(onSessionEnded).toHaveBeenCalledOnce();
    expect(current()).toBeNull();
    expect(await auth.isSignedIn()).toBe(false);
  });

  it("keeps the session when the refresh fails for another reason", async () => {
    const server = fakeApi({ refresh: () => Promise.resolve(problem(503, "SERVICE_UNAVAILABLE")) });
    server.expire();
    const { store, current } = memoryStore(signedIn);
    const onSessionEnded = vi.fn();
    const { api } = createApiClient({
      baseUrl: BASE,
      audience: "customer",
      store,
      onSessionEnded,
      fetch: server.fetch,
    });

    const { error } = await api.GET("/v1/staff/venues");

    expect(error).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(onSessionEnded).not.toHaveBeenCalled();
    expect(current()).toEqual(signedIn);
  });

  it("passes other 401s through without refreshing", async () => {
    const server = fakeApi();
    const { api } = createApiClient({
      baseUrl: BASE,
      audience: "customer",
      store: memoryStore().store,
      fetch: server.fetch,
    });

    const { error } = await api.GET("/v1/staff/venues");

    expect(error).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(server.refreshes()).toBe(0);
  });

  it("stores the session from sign-in and clears it on sign-out", async () => {
    const server = fakeApi();
    const { store, current } = memoryStore();
    const { auth } = createApiClient({
      baseUrl: BASE,
      audience: "customer",
      store,
      fetch: server.fetch,
    });

    await auth.start({
      accessToken: "access-1",
      accessTokenExpiresIn: 600,
      refreshToken: "refresh-1",
      refreshTokenExpiresIn: 5_184_000,
    });
    expect(current()).toEqual(signedIn);

    await auth.signOut();
    const signOut = server.requests.at(-1);
    expect(signOut?.method).toBe("DELETE");
    expect(new URL(signOut?.url ?? "").pathname).toBe("/v1/auth/customer/sessions/current");
    expect(signOut?.headers.get("Authorization")).toBe("Bearer access-1");
    expect(current()).toBeNull();
  });

  it("signs out locally even when offline", async () => {
    const { store, current } = memoryStore(signedIn);
    const { auth } = createApiClient({
      baseUrl: BASE,
      audience: "customer",
      store,
      fetch: () => Promise.reject(new TypeError("Network request failed")),
    });

    await auth.signOut();

    expect(current()).toBeNull();
  });

  it("sends admin requests with the CSRF header and refreshes through cookies", async () => {
    let expired = true;
    const requests: Request[] = [];
    const fetch = vi.fn((request: Request) => {
      requests.push(request);
      if (new URL(request.url).pathname === "/v1/auth/admin/sessions/refresh") {
        expired = false;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(expired ? problem(401, "TOKEN_EXPIRED") : json(200, []));
    });
    const { api } = createApiClient({ baseUrl: BASE, audience: "admin", fetch });

    const { response } = await api.GET("/v1/admin/invitations");

    expect(response.ok).toBe(true);
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/v1/admin/invitations",
      "/v1/auth/admin/sessions/refresh",
      "/v1/admin/invitations",
    ]);
    expect(requests.every((request) => request.headers.get("X-Hagz-Admin") === "1")).toBe(true);
    expect(requests.some((request) => request.headers.has("Authorization"))).toBe(false);
  });
});
