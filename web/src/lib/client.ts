import { hc } from 'hono/client'
import { getRequest } from '@tanstack/react-start/server'
import type { AppType } from '@/index';

export interface ErrorResponse {
  success: false;
  error: {
    code?: string;
    message: string;
    fields?: { field: string; message: string }[];
  };
};

// Change this later in production to read from the .env variable.
const isServer = typeof window === 'undefined';
const target = isServer ? 'http://api:8080' : 'http://localhost:8080';

const appFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);

  // Forward the cookies coming in from the request and use them to refresh the session if needed.
  if (isServer) {
    const request = getRequest();
    const cookie = request?.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
  };

  // If we are not on the server, treat it like a normal credentials client-side request.
  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status !== 401) return res;

  const refresh = await fetch(`${target}/auth/refresh`, {
    method: 'POST',
    headers: isServer ? { cookie: headers.get('cookie') ?? '' } : undefined,
    credentials: 'include',
  });

  if (!refresh.ok) return res;

  return fetch(input, { ...init, headers, credentials: 'include' });
};

export const client = hc<AppType>(target, {
  fetch: appFetch
});
