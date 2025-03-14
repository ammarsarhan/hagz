import { z } from "zod";
import prisma from "../utils/db";

export async function getPayment(id: string) {
    try {
        const payment = await prisma.payment.findUnique({
            where: {
                id: id
            },
            include: {
                reservation: {
                    select: {
                        id: true,
                        status: true,
                        startDate: true,
                        endDate: true,
                        reserveeName: true,
                        reserveePhone: true,
                        userId: true,
                        pitch: {
                            select: {
                                ownerId: true
                            }
                        }
                    }
                }
            }
        });

        if (!payment) {
            throw new Error("Could not find payment with the specified credentials.");
        }

        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getPaymentData(id: string, fields: string[]) {
    try {
        const fieldSchema = z.array(z.enum(["*", "userId", "ownerId", "pitchId", "amount", "status", "expiryDate", "isManual", "createdAt", "updatedAt"])).nonempty();
        const parsed = fieldSchema.safeParse(fields);

        if (!parsed.success) {
            throw new Error("Invalid fields provided. Unable to fetch reservation specific data.");
        };

        const payment = await prisma.payment.findUnique({
            where: { id },
            select: {
                id: true,
                amount: parsed.data.includes("amount"),
                status: parsed.data.includes("status"),
                expiryDate: parsed.data.includes("expiryDate"),
                isManual: parsed.data.includes("isManual"),
                createdAt: parsed.data.includes("createdAt"),
                updatedAt: parsed.data.includes("updatedAt"),
                reservation: {
                    select: {
                        id: true,
                        userId: parsed.data.includes("userId"),
                        pitchId: parsed.data.includes("pitchId"),
                        pitch: {
                            select: {
                                id: true,
                                ownerId: parsed.data.includes("ownerId")
                            }
                        }
                    }
                }
            }
        });

        if (!payment) {
            throw new Error("Could not fetch payment data. Failed to find payment with the specified credentials.");
        }

        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function createPayment(reservation: string, amount: number, expiryDate: Date, voidDate: Date, isManual?: boolean) {
    try {
        const status = isManual ? "MANUAL" : "PENDING";

        const payment = await prisma.payment.create({
            data: {
                reservationId: reservation,
                amount,
                expiryDate,
                voidDate,
                status,
                isManual
            }
        });

        if (!payment) {
            throw new Error("Failed to create payment successfully. Could not create payment.");
        }

        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function cancelPayment(id: string, refund?: boolean) {
    try {
        const payment = await prisma.payment.update({
            where: { id },
            data: { 
                status: refund ? "REFUNDED" : "CANCELLED"
            }
        })

        if (!payment) {
            throw new Error("Failed to cancel payment. Please try again later.")
        }

        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}