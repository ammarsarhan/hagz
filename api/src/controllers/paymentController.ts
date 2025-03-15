import { Request, Response } from "express";
import { getPayment } from "../repositories/paymentRepository";

export async function handleFetchPayment(req: Request, res: Response) {
    try {
        const id = req.params.payment;
        const data = await getPayment(id);
        res.status(200).json({ success: true, message: "Fetched payment data successfully.", data: data });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};
