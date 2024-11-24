import { NextRequest, NextResponse } from "next/server";
import { verifyOwner, isOwnerVerified } from "@/utils/auth/verify";
import { sign } from "jsonwebtoken";

export async function GET(request: NextRequest) {
    const id = new URL(request.url).searchParams.get("id") as string;
    const token = new URL(request.url).searchParams.get("token") as string;

    const verify = token && await verifyOwner(id, token);

    if (verify && verify.result) {
        const response = NextResponse.redirect("http://localhost:3000/auth/owner/sign-up");
        const ownerToken = sign({id: id}, process.env.JWT_SECRET as string, {expiresIn: "1h"});
        response.cookies.set("ownerToken", ownerToken, {httpOnly: true, sameSite: "lax"});

        return response;
    }

    if (verify && !verify.result) {
        return NextResponse.json({message: verify.message, status: 400}, {status: 400});
    }
    
    return NextResponse.json({message: "Could not verify user account.", status: 400}, {status: 400});
}

export async function POST(request: NextRequest) {
    const data = await request.json();
    const verified = data.email && await isOwnerVerified(data.email);

    return NextResponse.json({message: verified, status: 200}, {status: 200});
}