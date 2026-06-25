import { hc } from 'hono/client';
import type { AppType } from '../../api/src/index.js'
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';

// Adjust to match actual backend URL (e.g. from config/constants).
const API_URL = 'http://192.168.1.7:8080';

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const accessToken = await getAccessToken();
    const headers = new Headers(init?.headers);

    // Identify request as mobile for the Hono backend check.
    headers.set('X-Client-Type', 'mobile');

    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    let response = await fetch(input, { ...init, headers });

    // Intercept 401 and perform refresh.
    if (response.status === 401) {
        const refreshToken = await getRefreshToken();

        if (refreshToken) {
            try {
                const refresh = await fetch(`${API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        'X-Client-Type': 'mobile',
                        'X-Refresh-Token': refreshToken,
                    },
                });

                if (refresh.ok) {
                    const body = await refresh.json();
                    const newToken = body.data?.accessToken;

                    if (newToken) {
                        // Save the new access token (keeps the same refresh token).
                        await saveTokens(newToken, refreshToken);

                        // Retry original request with the new access token.
                        headers.set('Authorization', `Bearer ${newToken}`);
                        response = await fetch(input, { ...init, headers });
                    } else {
                        await clearTokens();
                    }
                } else {
                    await clearTokens();
                }
            } catch (error) {
                console.error('Mobile refresh token request failed:', error);
                await clearTokens();
            }
        }
    }

    return response;
}

export const client = hc<AppType>(API_URL, { fetch: authFetch });
