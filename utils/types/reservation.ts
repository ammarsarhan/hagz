import User from "@/utils/types/user";
import Payment from "@/utils/types/payment";
import Pitch from "@/utils/types/pitch";

export default interface Reservation {
    id: string;
    start: Date;
    end: Date;
    reserver: User;
    recurring: Boolean;
    payment: Payment | null;
    pitch: Pitch;
    status: "scheduled" | "done" | "cancelled";
}