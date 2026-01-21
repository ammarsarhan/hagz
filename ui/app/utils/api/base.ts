const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

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
        credentials: 'include',
    });

    if (!res.ok) {
        throw new Error(`An error has occurred: ${res.statusText}`);
    };

    const { data } = await res.json();
    return data;
};

export async function mutate<T>(endpoint: string, body: string, options: FetchOptions = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    
    const res = await fetch(url, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include',
    });

    if (!res.ok) {
        throw new Error(`An error has occurred: ${res.statusText}`);
    };

    const { data } = await res.json();
    return data;
};
