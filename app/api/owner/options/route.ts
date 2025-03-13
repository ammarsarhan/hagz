import prisma from "@/utils/db";

import { validateAccessTokenFromRequest } from "@/utils/auth/verify";
import { NextRequest, NextResponse } from "next/server";

export async function GET (req: NextRequest) {
    const data = validateAccessTokenFromRequest(req);

    if (data instanceof NextResponse) {
        return data;
    }

    try {
        const owner = await prisma.owner.findUnique({
            where: {
                id: data.id
            },
            select: {
                pitches: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        activePricingPlan: true
                    }
                }
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