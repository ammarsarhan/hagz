import { RequestError } from "@/app/utils/api/error";

export const BASE_URL = (typeof window === 'undefined' && process.env.INTERNAL_API_URL)
    ? process.env.INTERNAL_API_URL
    : process.env.NEXT_PUBLIC_API_URL;

interface FetchOptions {
    headers?: HeadersInit;
}

export async function query<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...(typeof window !== 'undefined' && { credentials: 'include' }),
        cache: 'no-store'
    });

    
    const { success, message, data } = await res.json();

    if (!success) {
        const error = new Error(message || "An unknown error has occurred.");
        (error as RequestError).status = res.status;
        throw error;
    };

    return data;
};

export async function mutate<T>(endpoint: string, body: object, options: FetchOptions = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    
    const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...(typeof window !== 'undefined' && { credentials: 'include' }),
        cache: 'no-store'
    });

    const { success, message, data } = await res.json();

    if (!success) {
        const error = new Error(message || "An unknown error has occurred.");
        (error as RequestError).status = res.status;
        throw error;
    };

    return data;
};
