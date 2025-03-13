import { createPayment, getPaymentData, cancelPayment } from "../repositories/paymentRepository";
import { createPaymentJob } from "../queues/paymentQueue";

export function getPaymentExpiryDate(startDate: Date, policy: "SHORT" | "DEFAULT" | "EXTENDED") {
    const paymentExpiry = new Date(startDate);
    let expiryFactor = 30;

    switch (policy) {
        case "SHORT":
            expiryFactor = 15;
            break;
        case "EXTENDED":
            expiryFactor = 60;
            break;
    }

    paymentExpiry.setUTCMinutes(paymentExpiry.getUTCMinutes() - expiryFactor);
    return paymentExpiry;
}

export function getPaymentVoidDate(startDate: Date, policy: "SHORT" | "DEFAULT" | "EXTENDED") {
    const paymentVoid = new Date(startDate);

    let voidFactor = 45;

    switch (policy) {
        case "SHORT":
            voidFactor = 30;
            break;
        case "EXTENDED":
            voidFactor = 75;
            break;
    }

    paymentVoid.setUTCMinutes(paymentVoid.getUTCMinutes() - voidFactor);
    return paymentVoid;
}

function getPaymentAmount(startDate: Date, endDate: Date, rate: number) {
    const difference = endDate.getTime() - startDate.getTime();
    const hours = difference / 1000 / 60 / 60;
    
    try {
        const amount = parseFloat((hours * rate).toFixed(2));
        return amount;
    } catch (error: any) {
        throw new Error("Failed to convert rate to a valid format. Please input valid values.");
    }
}

export async function initiatePayment(reservation: string, rate: number, startDate: Date, endDate: Date, policy: "SHORT" | "DEFAULT" | "EXTENDED", isManual?: boolean) {
    try {
        const expiryDate = getPaymentExpiryDate(startDate, policy);
        const voidDate = getPaymentVoidDate(startDate, policy);
        
        const amount = getPaymentAmount(startDate, endDate, rate);
    
        const payment = await createPayment(reservation, amount, expiryDate, voidDate, isManual);
        await createPaymentJob(payment.id, payment.expiryDate);
        
        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function processPayment(id: string) {
    try {
        const now = new Date();
        const payment = await getPaymentData(id, ["status", "isManual", "expiryDate"]);

        if (payment.status == "MANUAL" || payment.isManual) {
            throw new Error("Failed to process payment. Payment is marked as manual and requires manual intervention.");
        }

        if (payment.status == "EXPIRED" || payment.expiryDate < now) {
            throw new Error("Failed to initiate payment processing. Payment has expired and is no longer valid.");
        }

        if (payment.status != "PENDING") {
            throw new Error("Failed to process payment. Payment is not in a state where processing was anticipated.");
        }

        console.log("Handle payment processing for payment:", id);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function voidActivePayment(id: string) {
    try {
        const payment = await getPaymentData(id, ["status", "isManual"]);

        if (payment.status != "PENDING") {
            throw new Error("Failed to cancel payment. Payment may not be cancelled if it is no longer pending.");
        }

        const updated = await cancelPayment(id);
        return updated;
    } catch (error: any) {
        throw new Error(error.message);
    }
}