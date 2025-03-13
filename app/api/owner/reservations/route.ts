import { NextRequest, NextResponse } from "next/server";
import { validateAccessTokenFromRequest } from "@/utils/auth/verify";
import { getLocaleDate } from "@/utils/date";
import prisma from "@/utils/db";

export async function GET (request: NextRequest) {
    const tokenData = validateAccessTokenFromRequest(request);

    if (tokenData instanceof NextResponse) {
        return tokenData;
    }

    const id = request.headers.get("Pitch");

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
        return NextResponse.json({message: "From and to dates are required."}, {status: 400});
    }

    const fromLocaleString = decodeURIComponent(from);
    const toLocaleString = decodeURIComponent(to);

    if (!fromLocaleString || !toLocaleString) {
        return NextResponse.json({message: "Invalid date format input."}, {status: 400});
    };

    const fromDate = getLocaleDate(fromLocaleString);
    const toDate =  getLocaleDate(toLocaleString);

    if (!id) {
        return NextResponse.json({message: "Pitch Id was not provided."}, {status: 400});
    }

    const owner = await prisma.owner.findUnique({
        where: {
            id: tokenData.id
        },
        include: {
            pitches: true
        }
    })

    if (!owner) {
        return NextResponse.json({message: "Invalid access token passed. Could not find user."}, {status: 404});
    }

    let pitch = owner.pitches.find(pitch => pitch.id == id);

    if (!pitch) {
        return NextResponse.json({message: "Pitch not found."}, {status: 404});
    }

    const reservations = await prisma.reservation.findMany({
        where: {
            pitchId: id,
            startDate: {
                gte: fromDate
            },
            endDate: {
                lte: toDate
            }
        },
        include: {
            payment: true
        }
    })

    return NextResponse.json({reservations: reservations, status: 200}, {status: 200});
}