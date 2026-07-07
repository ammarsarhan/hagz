import i18n from "@/i18next/i18next";
import type { AppType } from "@/index";
import { hc } from "hono/client";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "@/lib/storage";

// Adjust to match actual backend URL (e.g. from config/constants).
const base = process.env.EXPO_PUBLIC_API_URL;

const REQUEST_TIMEOUT_MS = 10_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const accessToken = await getAccessToken();
  const headers = new Headers(init?.headers);

  // Identify request as mobile for the Hono backend check.
  headers.set("X-Client-Type", "mobile");

  // Set the Accept-Language header for the requests for this session.
  const language = i18n.language;
  headers.set("Accept-Language", language);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response = await fetchWithTimeout(input, { ...init, headers });

  // Intercept 401 and perform refresh.
  if (response.status === 401) {
    const refreshToken = await getRefreshToken();

    if (refreshToken) {
      try {
        const refresh = await fetchWithTimeout(`${base}/auth/refresh`, {
          method: "POST",
          headers: {
            "X-Client-Type": "mobile",
            "X-Refresh-Token": refreshToken,
          },
        });

        if (refresh.ok) {
          const body = await refresh.json();
          const newToken = body.data?.accessToken;

          if (newToken) {
            // Save the new access token (keeps the same refresh token).
            await saveTokens(newToken, refreshToken);

            // Retry original request with the new access token.
            headers.set("Authorization", `Bearer ${newToken}`);
            response = await fetchWithTimeout(input, { ...init, headers });
          } else {
            await clearTokens();
          }
        } else {
          await clearTokens();
        }
      } catch (error) {
        console.error("Mobile refresh token request failed:", error);
        await clearTokens();
      }
    }
  }

  return response;
}

export const client = hc<AppType>(base, { fetch: authFetch });
