export interface CreatePaymentIntentionPayload {
    amount: number;
    currency: string;
    expiration: number;
    bookingId: string;
    customer: {
        first_name: string;
        last_name: string;
        phone: string;
        email?: string;
    };
    allowedMethods: ("card" | "wallet" | "cash")[];
}

export interface CreatePaymentIntentionResponse {
    client_secret: string;
    payment_keys: { 
        key: string; 
        integration_id: number;
    }[];
}
