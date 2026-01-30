import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/app/utils/api/base";

export default async function proxy(req: NextRequest) {
    const access = req.cookies.get("accessToken");
    const refresh = req.cookies.get("refreshToken");
    
    if (!access && refresh) {        
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: {
                "Cookie": req.headers.get("cookie") || "",
                "Content-Type": "application/json",
            }
        });
        
        if (res.ok) {
            const response = NextResponse.redirect(req.url);

            const setCookie = res.headers.get("set-cookie");
            
            if (setCookie) {
                response.headers.set("set-cookie", setCookie);
            }

            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next|static|favicon.ico).*)"],
};