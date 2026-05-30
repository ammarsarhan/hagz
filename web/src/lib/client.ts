import { hc } from 'hono/client'
import type { AppType } from '@/index';

export interface ErrorResponse {
  success: false;
  error: {
    code?: string;
    message: string;
    fields?: { field: string; message: string }[];
  };
};


export const client = hc<AppType>('http://localhost:8080', {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        credentials: 'include',
      }),
});
