import Reservation from "@/utils/types/reservation";
import Location from "@/utils/types/location";
import { Owner } from "@/utils/types/user";

export enum Amenity { 
    "Indoors", "BallProvided", "Seating", "NightLights", "Parking", "Showers", "ChangingRooms", "Cafeteria", "FirstAid", "Security"
}

export default interface Pitch {
    uid: string;
    location: Location;
    type: "SG" | "AG" | "FG" | "TF";
    size: "5-a-side" | "7-a-side" | "full";
    price: number;
    rating: number;
    owner: Owner;
    amenities: Amenity[];
    reservations: Reservation[];
}