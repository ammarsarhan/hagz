import { z } from "zod";
import prisma from "../utils/db";

export function getPayment(id: string) {
    try {
        const payment = prisma.payment.findUnique({
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
        const fieldSchema = z.array(z.enum(["*", "amount", "status", "expiryDate", "createdAt", "updatedAt"])).nonempty();
        const parsed = fieldSchema.safeParse(fields);

        if (!parsed.success) {
            throw new Error("Invalid fields provided. Unable to fetch reservation specific data.");
        }

        const payment = await prisma.payment.findUnique({
            where: { id },
            select: {
                id: true,
                amount: parsed.data.includes("amount"),
                status: parsed.data.includes("status"),
                expiryDate: parsed.data.includes("expiryDate"),
                createdAt: parsed.data.includes("createdAt"),
                updatedAt: parsed.data.includes("updatedAt"),
                reservation: {
                    select: {
                        id: true
                    }
                }
            }
        })

        if (!payment) {
            throw new Error("Could not fetch payment data. Failed to find payment with the specified credentials.");
        }

        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function createPayment(reservation: string, amount: number, expiryDate: Date, manual?: boolean) {
    try {
        const payment = await prisma.payment.create({
            data: {
                reservationId: reservation,
                amount,
                expiryDate,
                manual
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