import { NextRequest, NextResponse } from "next/server";
import { validateAccessTokenFromRequest } from "@/utils/auth/verify";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { checkReservationOverlap } from "@/utils/reservations/reservation";
import z from 'zod';

import prisma from "@/utils/db";
import { today } from "@/utils/date";

export async function POST (request: NextRequest) {
    const accessToken = validateAccessTokenFromRequest(request);

    if (accessToken instanceof NextResponse) {
        return accessToken;
    }

    const data = await request.json();

    const { 
        reserveeName,
        reserveePhone,
        reserveeEmail,
        pitch, 
        owner, 
        date, 
        startTime, 
        endTime, 
        recurring, 
        recurringDates, 
        total, 
        status, 
        paymentMethod 
    } = data;

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const inputTest = z.object({
        reserveeName: z.string().min(1).max(50),
        reserveePhone: z.string().min(13).max(13).regex(/^\d{4}-\d{3}-\d{4}$/),
        reserveeEmail: z.string().email().optional(),
        pitch: z.string().min(1),
        owner: z.string().min(1),
        date: z.date().min(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)),
        startDate: z.date().min(new Date()),
        endDate: z.date().min(startDate),
        recurring: z.boolean(),
        recurringDates: z.array(z.date()).min(2).max(8).optional(),
        total: z.number().min(100),
        status: z.string(),
        paymentMethod: z.string()
    })

    const inputSchema = inputTest.safeParse({
        reserveeName: reserveeName,
        reserveePhone: reserveePhone,
        reserveeEmail: reserveeEmail || undefined,
        pitch: pitch,
        owner: owner,
        date: new Date(date),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        recurring: recurring,
        recurringDates: recurringDates.forEach((date: string) => new Date(date)),
        total: parseFloat(total),
        paymentMethod: JSON.stringify(paymentMethod),
        status: status,
    });

    if (inputSchema.error) {
        return NextResponse.json({message: inputSchema.error, status: 400}, {status: 400})
    }

    const overlap = await checkReservationOverlap(pitch, startDate, endDate);

    if (overlap instanceof NextResponse) {
        return overlap;
    }

    try {
        const reservation = await prisma.reservation.create({
            data: {
                reserveeName: reserveeName,
                reserveeEmail: reserveeEmail,
                reserveePhone: reserveePhone,
                pitchId: pitch,
                startDate: startDate,
                endDate: endDate,
                recurring: recurring,
                recurringDates: recurringDates,
                status: status
            }
        });

        const payment = await prisma.payment.create({
            data: {
                ownerId: owner,
                reservationId: reservation.id,
                amount: 0,
                total: total,
                method: paymentMethod,
                date: new Date(date),
                status: "Pending",
            }
        })

        return NextResponse.json({message: payment.id, status: 200}, {status: 200});
    } catch (error) {
        let err = error as PrismaClientKnownRequestError;
        return NextResponse.json({message: err.message, status: 500}, {status: 500});
    }
}