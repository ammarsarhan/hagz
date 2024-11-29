import prisma from "@/utils/db";

import { OwnerAccessTokenType } from "@/utils/types/tokens";
import { verify } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

export async function GET (req: NextRequest) {
    const accessHeader = req.headers.get("Authorization");

    if (!accessHeader || !accessHeader.startsWith('Bearer ')) {
        return NextResponse.json({ message: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const accessToken = accessHeader.split('Bearer ')[1];

    if (!accessToken) {
        return NextResponse.redirect("/auth/owner/sign-in");
    }

    const data = verify(accessToken, process.env.JWT_SECRET as string) as OwnerAccessTokenType;
    if (!data) {
        return NextResponse.redirect("/auth/owner/sign-in");
    }

    try {
        const owner = await prisma.owner.findUnique({
            where: {
                id: data.id
            },
            select: {
                pitches: true
            }
        })
    
        if (!owner) {
            return NextResponse.json({message: "Could not fetch owner pitch data. Please try again later.", status: 404}, {status: 404});
        }
        
        return NextResponse.json({pitches: owner.pitches}, {status: 200});
    } catch (error) {
        return NextResponse.json({message: "Could not fetch owner pitch data. Please try again later.", status: 500}, {status: 500});
    }
}