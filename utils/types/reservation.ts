import PitchType from "@/utils/types/pitch";
import Payment from "@/utils/types/payment";

export type ReservationStatus = "Pending" | "Confirmed" | "Completed" | "Cancelled" | "Error";

export default interface Reservation {
    id: string;
    startDate: Date;
    endDate: Date;
    recurring: boolean;
    status: ReservationStatus;
    pitchId: string;
    pitch: PitchType;
    payment: Payment;
    isLocked: boolean;
}