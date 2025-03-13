import prisma from "@/utils/db";
import { NextResponse } from "next/server";

export async function checkReservationOverlap (pitch: string, startDate: Date, endDate: Date) {
    const currentReservation = await prisma.reservation.findFirst({
        where: {
            pitchId: pitch,
            OR: [
                {
                    startDate: {
                        equals: startDate
                    }
                },
                {
                    endDate: {
                        equals: endDate
                    }
                }
            ]
        }
    })

    console.log("Current reservation:", currentReservation);

    if (currentReservation) {
        return NextResponse.json({message: "Pitch is already reserved for the selected date range.", status: 400}, {status: 400});
    }

    const previousReservation = await prisma.reservation.findFirst({
        where: {
            pitchId: pitch,
            startDate: {
                lt: startDate
            }
        }
    })

    console.log("First previous reservation:", previousReservation);

    if (previousReservation) {
        if (previousReservation.endDate > startDate && previousReservation.endDate < endDate) {
            return NextResponse.json({message: "Case 1. Pitch is already reserved for the selected date range.", status: 400}, {status: 400});
        }

        if (previousReservation.startDate < startDate && previousReservation.endDate > endDate) {
            return NextResponse.json({message: "Case 2. Pitch is already reserved for the selected date range.", status: 400}, {status: 400});
        }
    }

    const nextReservation = await prisma.reservation.findFirst({
        where: {
            pitchId: pitch,
            startDate: {
                gt: startDate
            }
        }
    })

    console.log("First next reservation:", nextReservation);

    if (nextReservation) {
        if (nextReservation.startDate < endDate && nextReservation.startDate > startDate) {
            return NextResponse.json({message: "Case 3. Pitch is already reserved for the selected date range.", status: 400}, {status: 400});
        }
    }

    if (startDate.getDay() == 15) {
        return NextResponse.json({message: "Case 4. Pitch is already reserved for the selected date range.", status: 400}, {status: 400});
    }

    return {previousReservation, nextReservation};
}