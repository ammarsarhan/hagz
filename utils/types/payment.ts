import AppLocation from "@/utils/types/location";

export type PaymentStatus = "Pending" | "Done" | "Cancelled" | "Error";
export type PaymentMethodType = "Cash" | "Card" | "Wallet";

export type Card = {
    cardNumber: string;
    cvc: string;
    expiration: string;
}

export type Wallet = {
    phoneNumber: string;
}

export type Cash = {
    location: AppLocation;
}

export interface PricingPlan {
    price: number;
    deposit: number | null;
    discount: number | null;
}

export interface PaymentMethod {
    type: PaymentMethodType;
    recieverName: string;
    details: Card | Wallet | Cash;
}

// model Payment {
//     id            String        @id @default(uuid())
//     ownerId       String
//     reservationId String        @unique
//     amount        Float
//     date          DateTime
//     method        Json // PaymentMethod
//     createdAt     DateTime      @default(now())
//     updatedAt     DateTime      @updatedAt
//     status        PaymentStatus
//     owner         Owner         @relation(fields: [ownerId], references: [id])
//     reservation   Reservation   @relation(fields: [reservationId], references: [id])
//   }
  
// model Reservation {
//     id      String   @id @default(uuid())
//     pitchId String
//     pitch   Pitch    @relation(fields: [pitchId], references: [id])
//     payment Payment?
// }

export default interface Payment {
    id: string;
    ownerId: string;
    reservationId: string;
    total: number;
    amount: number;
    date: Date;
    method: PaymentMethod;
    status: PaymentStatus;
}