export type AmenityName = "LIGHTING" | "SEATING" | "LOCKER_ROOMS" | "SHOWERS" | "TOILETS" | "PARKING" | "AIR_CONDITIONED" | "HEATING" | "SOUND_SYSTEM" | "WATER_FOUNTAIN" | "WIFI" | "BALL_INCLUDED" | "EQUIPMENT_RENTAL" | "FIRST_AID" | "REFEREE_SERVICE" | "CAFETERIA";
export type PaymentMethod = "CASH" | "CREDIT_CARD" | "WALLET";
export type StaffRole = "OWNER" | "MANAGER";

export interface DashboardStateType {
    permissions: Array<{
        userId: string;
        role: StaffRole;
        pitch: {
            id: string;
            nameEn: string;
            nameAr: string;
        };
    }>
}
