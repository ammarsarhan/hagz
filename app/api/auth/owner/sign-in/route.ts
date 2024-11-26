import { authenticateOwnerWithCredentials } from "@/utils/auth/owner";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const data = await request.json();

    if (!data.email || !data.password) {
        return NextResponse.json({message: "Insufficient parameters provided. Unable to log in successfully.", status: 400}, {status: 400});
    }

    const authenticated = await authenticateOwnerWithCredentials(data.email, data.password);

    if (authenticated.status != 200) {
        return NextResponse.json({message: authenticated.message, status: authenticated.status}, {status: authenticated.status});
    }

    if (!authenticated.accessToken || !authenticated.refreshToken) {
        return NextResponse.json({message: "An error occurred while generating tokens. Please try again.", status: 500}, {status: 500});
    }

    const response = NextResponse.json({token: authenticated.accessToken, status: 200}, {status: 200});
    response.cookies.set("refreshToken", authenticated.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return response;
}