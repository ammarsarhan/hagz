import { cookies } from "next/headers";

export default async function getTokens() {
    const store = await cookies();

    const accessCookie = store.get('accessToken');
    const refreshCookie = store.get('refreshToken');

    const accessToken = accessCookie?.value;
    const refreshToken = refreshCookie?.value;

    const pieces: string[] = [];

    if (accessToken) pieces.push(`accessToken=${accessToken}`);
    if (refreshToken) pieces.push(`refreshToken=${refreshToken}`);
    
    const header = pieces.length > 0 ? pieces.join('; ') : undefined;
    return header;
}
