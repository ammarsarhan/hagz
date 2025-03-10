import { createPayment } from "../repositories/paymentRepository";
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
        const amount = getPaymentAmount(startDate, endDate, rate);
    
        const payment = await createPayment(reservation, amount, expiryDate, isManual);
        await createPaymentJob(payment.id, payment.expiryDate);
        
        return payment;
    } catch (error: any) {
        throw new Error(error.message);
    }
}