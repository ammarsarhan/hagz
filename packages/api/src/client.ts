import createClient from "openapi-fetch";
import type { components, paths } from "./generated/openapi";

export type Language = "ar" | "en";
export type Session = components["schemas"]["Session"];

// Only the two tokens are kept; the lifetimes in a Session are for the server's bookkeeping, and the
// API says when a token has expired (TOKEN_EXPIRED) rather than the client guessing from a clock.
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

// Where a bearer session lives between launches. The Expo apps use secureSessionStore().
export interface SessionStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

interface CommonOptions {
  baseUrl: string;
  // Sent as Accept-Language. Without it the API answers in Arabic, its default.
  language?: () => Language;
  // Called when the session can't be refreshed any more (SESSION_ENDED): show sign-in.
  onSessionEnded?: () => void;
  // Only ever called with a Request. For tests, and for runtimes without a global fetch.
  fetch?: (request: Request) => Promise<Response>;
}

export type ApiClientOptions = CommonOptions &
  (
    | {
        // Customers and staff: bearer tokens, kept in `store`.
        audience: "customer" | "staff";
        store: SessionStore;
        // The Expo apps identify themselves so the API can refuse builds too old to talk to it
        // (426 APP_UPDATE_REQUIRED).
        app?: { name: "customer" | "dashboard"; version: string };
      }
    | {
        // Admins: httpOnly cookies the page never sees, through the web app's own origin.
        audience: "admin";
      }
  );

const refreshPaths = {
  customer: "/v1/auth/customer/sessions/refresh",
  staff: "/v1/auth/staff/sessions/refresh",
  admin: "/v1/auth/admin/sessions/refresh",
} as const;

const signOutPaths = {
  customer: "/v1/auth/customer/sessions/current",
  staff: "/v1/auth/staff/sessions/current",
  admin: "/v1/auth/admin/sessions/current",
} as const;

// Required on every cookie-authenticated request; it's the API's CSRF defense.
const ADMIN_HEADER = "X-Hagz-Admin";

const problemCode = async (response: Response): Promise<string | undefined> => {
  if (!response.headers.get("Content-Type")?.includes("json")) return undefined;
  try {
    const body: unknown = await response.clone().json();
    return typeof body === "object" && body !== null && "code" in body
      ? String(body.code)
      : undefined;
  } catch {
    return undefined;
  }
};

// `response` is the refresh's own error, when there was a refresh to try.
type Refreshed = { ok: true } | { ok: false; response?: Response };

export const createApiClient = (options: ApiClientOptions) => {
  const baseFetch = options.fetch ?? ((request: Request) => globalThis.fetch(request));
  const bearer = options.audience === "admin" ? undefined : options;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  // undefined until read from the store; null when signed out.
  let current: StoredSession | null | undefined;
  // Bumped whenever the session changes, so a request that failed with an old token can tell that
  // someone else already refreshed and just retry, instead of refreshing a second time.
  let generation = 0;
  // Every request that finds its token expired waits on the same refresh: refresh tokens rotate, so
  // two parallel refreshes would each present the same token, and outside the server's 30 s grace
  // window that looks like theft and revokes the session.
  let refreshing: Promise<Refreshed> | undefined;

  const load = async () => {
    if (current === undefined && bearer) current = await bearer.store.load();
    return current ?? null;
  };

  const save = async (session: StoredSession | null) => {
    current = session;
    generation += 1;
    if (bearer) await (session ? bearer.store.save(session) : bearer.store.clear());
  };

  const withHeaders = async (request: Request) => {
    const language = options.language?.();
    if (language) request.headers.set("Accept-Language", language);
    if (bearer?.app) {
      request.headers.set("X-App", bearer.app.name);
      request.headers.set("X-App-Version", bearer.app.version);
    }
    if (bearer) {
      const session = await load();
      if (session) request.headers.set("Authorization", `Bearer ${session.accessToken}`);
      else request.headers.delete("Authorization");
    } else {
      request.headers.set(ADMIN_HEADER, "1");
    }
    return request;
  };

  const endSession = async () => {
    const hadSession = bearer ? (await load()) !== null : true;
    await save(null);
    if (hadSession) options.onSessionEnded?.();
  };

  const refreshOnce = async (): Promise<Refreshed> => {
    const session = await load();
    if (bearer && !session) return { ok: false };

    const request = await withHeaders(
      new Request(baseUrl + refreshPaths[options.audience], {
        method: "POST",
        ...(session && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        }),
      }),
    );
    request.headers.delete("Authorization");

    const response = await baseFetch(request);
    if (response.ok) {
      if (bearer) {
        const next = (await response.json()) as Session;
        await save({ accessToken: next.accessToken, refreshToken: next.refreshToken });
      } else {
        // The new cookies are already set; only the generation needs to move on.
        generation += 1;
      }
      return { ok: true };
    }
    // The refresh token was revoked, expired or reused. Anything else (503, a timeout) leaves the
    // session alone: the same refresh token works on the next try.
    if (response.status === 401) await endSession();
    return { ok: false, response };
  };

  const refresh = (sentAt: number): Promise<Refreshed> => {
    if (generation !== sentAt) return Promise.resolve({ ok: true });
    refreshing ??= refreshOnce().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  };

  // openapi-fetch hands every request to this. Expired access tokens are refreshed and the request
  // sent once more, so screens never see TOKEN_EXPIRED.
  const send = async (input: Request): Promise<Response> => {
    // Kept before sending, because sending uses up the body.
    const retry = input.clone();
    const sentAt = generation;
    const response = await baseFetch(await withHeaders(input));
    if (response.status !== 401 || (await problemCode(response)) !== "TOKEN_EXPIRED") {
      return response;
    }

    const refreshed = await refresh(sentAt);
    // The refresh's error says more than TOKEN_EXPIRED (SESSION_ENDED, SERVICE_UNAVAILABLE). Each
    // waiter gets its own copy, since a body can be read only once.
    if (!refreshed.ok) return refreshed.response?.clone() ?? response;
    return baseFetch(await withHeaders(retry));
  };

  const api = createClient<paths>({ baseUrl, fetch: send });

  const auth = {
    // After sign-up, sign-in or completing two-factor: the response's `session`. (Admin sessions
    // are cookies the API sets itself, so admins never call this.)
    start: (session: Session) =>
      save({ accessToken: session.accessToken, refreshToken: session.refreshToken }),

    isSignedIn: async () => (await load()) !== null,

    // Ends the session on the server too, so its refresh token stops working at once. Signed out
    // locally even when that call fails: the user asked to leave this device.
    signOut: async () => {
      try {
        await send(new Request(baseUrl + signOutPaths[options.audience], { method: "DELETE" }));
      } catch {
        // Offline: the refresh token expires on its own.
      }
      await save(null);
    },
  };

  return { api, auth };
};

export type ApiClient = ReturnType<typeof createApiClient>["api"];
