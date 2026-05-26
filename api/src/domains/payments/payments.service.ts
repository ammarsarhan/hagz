import { InternalServerError } from "@/shared/lib/utils/error.js";
import type { CreatePaymentIntentionPayload } from "@/shared/types/payments.js";

export default class PaymentService {
    private readonly BASE_URL = "https://accept.paymob.com";
    private readonly SECRET_KEY = process.env.PAYMOB_SECRET_KEY!;
    private readonly HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET!;

    private readonly CARD_INTEGRATION_ID = 5690978;
    private readonly WALLET_INTEGRATION_ID = 4992888;
    private readonly CASH_INTEGRATION_ID = 4872526;

    private mapMethods(methods: string[]): number[] {
        const map: Record<string, number> = {
            card:   this.CARD_INTEGRATION_ID,
            wallet: this.WALLET_INTEGRATION_ID,
            cash:   this.CASH_INTEGRATION_ID,
        };
        return methods.map(m => map[m]).filter(Boolean);
    };

    createIntention = async (payload: CreatePaymentIntentionPayload) => {
        const response = await fetch(`${this.BASE_URL}/v1/intention/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Token ${this.SECRET_KEY}`,
            },
            body: JSON.stringify({
                amount: payload.amount,
                currency: payload.currency,
                expiration: payload.expiration,
                payment_methods: this.mapMethods(payload.allowedMethods),
                items: [{
                    name: `Booking ${payload.bookingId}`,
                    amount: payload.amount,
                    description: `Sports ground booking for Hagz.`,
                    quantity: 1
                }],
                billing_data: {
                    first_name: payload.customer.first_name,
                    last_name: payload.customer.last_name,
                    phone_number: payload.customer.phone,
                    email: payload.customer.email ?? "NA@NA.com",
                    // Required by Paymob even if not used.
                    apartment: "NA", floor: "NA", street: "NA",
                    building: "NA", city: "Cairo", country: "EG",
                    shipping_method: "NA", postal_code: "NA", state: "NA"
                },
                extras: { booking_id: payload.bookingId }, // To be used to point to the booking in the webhook.
                redirection_url: `https://www.hagz.com/bookings/${payload.bookingId}`
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new InternalServerError(`Paymob intention failed: ${JSON.stringify(error)}`);
        };

        return response.json();
    }

    // HMAC verification for webhooks.
    verifyHmac = async (data: Record<string, string>, receivedHmac: string) => {
        const keys = [
        "amount_cents","created_at","currency","error_occured",
        "has_parent_transaction","id","integration_id","is_3d_secure",
        "is_auth","is_capture","is_refunded","is_standalone_payment",
        "is_voided","order","owner","pending","source_data.pan",
        "source_data.sub_type","source_data.type","success"
        ];
        
        const concatenated = keys.map(k => data[k] ?? "").join("");
        
        const crypto = await import("crypto");
        const computed = crypto
            .createHmac("sha512", this.HMAC_SECRET)
            .update(concatenated)
            .digest("hex");
        
        return computed === receivedHmac;
    }
}