import { cookies } from "next/headers";

export default async function getTokens() {
    const store = await cookies();

    const accessCookie = store.get('accessToken');
    const refreshCookie = store.get('refreshToken');

    const accessToken = accessCookie?.value;
    const refreshToken = refreshCookie?.value;

    return { accessToken, refreshToken };
};

export function buildHeaders(accessToken: string | undefined, refreshToken: string | undefined) {
    const cookies: string[] = [];

    if (accessToken) cookies.push(`accessToken=${accessToken}`);
    if (refreshToken) cookies.push(`refreshToken=${refreshToken}`);
    
    const header = cookies.length > 0 ? cookies.join('; ') : undefined;
    return header;
}
