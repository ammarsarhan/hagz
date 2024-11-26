import { NextRequest, NextResponse } from "next/server";
import { verifyOwner, isOwnerVerified } from "@/utils/auth/verify";
import { sign, verify } from "jsonwebtoken";
import prisma from "@/utils/db";
import { CreationTokenType } from "@/utils/types/tokens";

export async function GET(request: NextRequest) {
    const id = new URL(request.url).searchParams.get("id") as string;
    const token = new URL(request.url).searchParams.get("token") as string;

    const verifyRes = token && await verifyOwner(id, token);

    if (verifyRes && verifyRes.result) {
        const decoded = verify(token, process.env.JWT_SECRET as string) as CreationTokenType;
        let owner = await prisma.owner.findUnique({where: {email: decoded.email}});

        if (!owner) {
            return NextResponse.json({message: "An error occurred while verifying the owner.", status: 500}, {status: 500});
        }

        const response = NextResponse.redirect("http://localhost:3000/auth/owner/sign-up");
        const creationToken = sign({id: owner.id, email: owner.email, name: owner.firstName}, process.env.JWT_SECRET as string, {expiresIn: "1h"});

        // Add secure; attribute when deploying to production
        response.headers.set('Set-Cookie', `creationToken=${creationToken}; Path=/`);
        return response;
    }

    if (verifyRes && !verifyRes.result) {
        return NextResponse.json({message: verifyRes.message, status: 400}, {status: 400});
    }
    
    return NextResponse.json({message: "Could not verify user account.", status: 400}, {status: 400});
}

export async function POST(request: NextRequest) {
    const data = await request.json();
    const verified = data.email && await isOwnerVerified(data.email);

    return NextResponse.json({message: verified, status: 200}, {status: 200});
}