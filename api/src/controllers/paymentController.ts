import { Request, Response } from "express";
import { getPayment, getPaymentData } from "../repositories/paymentRepository";
import prisma from "../utils/db";

export async function handleFetchPayment(req: Request, res: Response) {
    try {
        const id = req.params.payment;
        const data = await getPayment(id);
        res.status(200).json({ success: true, message: "Fetched payment data successfully.", data: data });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleProcessPayment(req: Request, res: Response) {
    try {
        const id = req.params.payment;
        const data = await getPaymentData(id, ["status"]);

        if (data.status != "PENDING") {
            res.status(400).json({ success: false, message: "Failed to process payment. Current payment status is not pending." });
        }

        const payment = await prisma.payment.update({
            where: { id },
            data: {
                status: "PAID"
            }
        });

        if (!payment) {
            throw new Error("Could not update payment status to PAID.")
        }

        res.status(200).json({ success: true, message: "Paid for reservation successfully.", data: payment })
        return;

        // To-Do Later: Hook this up to Fawry or Paymob
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}