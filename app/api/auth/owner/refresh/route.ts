import { generateAccessToken } from "@/utils/auth/owner";
import { verify } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/utils/db";
import { OwnerRefreshTokenType } from "@/utils/types/tokens";

export async function POST(request: NextRequest) {
    const refreshCookie = request.cookies.get('refreshToken');
    
    if (!refreshCookie) {
        return NextResponse.json({message: "Invalid request, no refresh token provided.", status: 400}, {status: 400});
    }

    const refreshToken = refreshCookie.value;
    
    if (!refreshToken) {
        return NextResponse.json({message: "Invalid request, no refresh token provided.", status: 400}, {status: 400});
    }

    try {
        const decoded = verify(refreshToken, process.env.JWT_SECRET as string) as OwnerRefreshTokenType;
        
        const owner = await prisma.owner.findUnique({
            where: { id: decoded.id }
        })

        if (!owner) {
            return NextResponse.json({message: "Invalid refresh token.", status: 401}, {status: 401});
        }

        const accessToken = generateAccessToken(owner.firstName, owner.email, owner.id);
        return NextResponse.json({token: accessToken, status: 200}, {status: 200});
        
    } catch (error) {
        return NextResponse.json({message: "Could not generate access token.", status: 401}, {status: 401});
    }
}