import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/app/utils/api/base";
import { User } from "./app/utils/types/user";
import { verify } from "jsonwebtoken";

export default async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    const accessToken = req.cookies.get("accessToken");
    const refreshToken = req.cookies.get("refreshToken");
    
    if (!accessToken && refreshToken) {        
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
    };

    if (pathname.startsWith("/dashboard")) {
        if (!accessToken) {
            return NextResponse.redirect(new URL("/auth/sign-in", req.url));
        };

        try { 
            const user = verify(accessToken.value, process.env.ACCESS_SECRET!) as User;
    
            if (!user.isVerified) return NextResponse.redirect(new URL("/auth/verify", req.url));
            if (user.role != "ADMIN") return NextResponse.redirect(new URL("/auth/sign-in", req.url));
            if (!user.isOnboarded && pathname != "/dashboard/onboarding") return NextResponse.redirect(new URL("/dashboard/onboarding", req.url));
        } catch {
            return NextResponse.redirect(new URL("/auth/sign-in", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next|static|favicon.ico).*)"],
};