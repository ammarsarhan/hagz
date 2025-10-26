import { cookies } from "next/headers";

// Helper function to extract cookies from the request and append them to the request on the server-side.
export default async function extractCookies() {
    const store = await cookies();

    const accessToken = store.get("accessToken")?.value;
    const refreshToken = store.get("refreshToken")?.value;

    // Build cookie header only from defined values
    const parts = [];
    if (accessToken) parts.push(`accessToken=${accessToken}`);
    if (refreshToken) parts.push(`refreshToken=${refreshToken}`);

    const header = parts.join("; ");

    return { accessToken, refreshToken, header };
}