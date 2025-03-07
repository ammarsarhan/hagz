export async function handlePaymentCreation(startDate: Date, policy: "SHORT" | "DEFAULT" | "EXTENDED") {
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
}