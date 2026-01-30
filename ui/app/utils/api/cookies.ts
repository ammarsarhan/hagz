import { cookies } from "next/headers";
import { cache } from "react";
import { verify } from "jsonwebtoken";

import { User } from "@/app/utils/types/user";

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

export const getUser = cache(async () => {
    try {
        const store = await cookies();
        const accessCookie = store.get("accessToken");
        const accessToken = accessCookie?.value;
    
        if (!accessToken) return null;
        
        const decoded = verify(accessToken, process.env.ACCESS_SECRET!) as User;
        return decoded;
    } catch {
        return null;
    }
});
