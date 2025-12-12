import { 
  MdEventSeat, MdLightbulb, MdOutlineFireplace, MdOutlineSpeaker, MdWaterDrop 
} from "react-icons/md";
import { 
  FaShower, FaToilet, FaParking, FaWifi, FaSnowflake, FaFutbol, FaFirstAid 
} from "react-icons/fa";
import { 
  GiLockers, GiWhistle, GiPerson 
} from "react-icons/gi";
import { IoFastFood } from "react-icons/io5";

export type Amenity = "SEATING" | "LOCKER_ROOMS" | "LIGHTING" | "CAFETERIA" | "SHOWERS" | "TOILETS" | "PARKING" | "AIR_CONDITIONED" | "HEATING" | "SOUND_SYSTEM" | "WATER_FOUNTAIN" | "WIFI" | "BALL_INCLUDED" | "EQUIPMENT_RENTAL" | "FIRST_AID" | "REFEREE_SERVICE";
export type PayoutRate = "BIWEEKLY" | "MONTHLY";
export type BillingMethod = "CASH" | "CREDIT_CARD" | "WALLET";
export type BookingSource = "PLATFORM" | "IN_PERSON" | "PHONE" | "OTHER";
export type PitchStatus = "DRAFT" | "PENDING" | "REJECTED" | "APPROVED" | "LIVE" | "DELETED" | "SUSPENDED" | "ARCHIVED";

export interface AmenityGroup { 
    group: string; 
    items: { 
        label: string; 
        key: Amenity; 
        icon: React.ReactNode
    }[] 
};

export const billingMethodMap = new Map<BillingMethod, string>([
    ["CASH", "Cash"],
    ["CREDIT_CARD", "Credit Card"],
    ["WALLET", "Wallet"]
])

export const amenityMap = new Map<string, string>([
  ["SEATING", "Seating"],
  ["LOCKER_ROOMS", "Locker Rooms"],
  ["SHOWERS", "Showers"],
  ["TOILETS", "Toilets"],
  ["CAFETERIA", "Cafeteria"],
  ["LIGHTING", "Lighting"],
  ["AIR_CONDITIONED", "Air Conditioned"],
  ["HEATING", "Heating"],
  ["SOUND_SYSTEM", "Sound System"],
  ["PARKING", "Parking"],
  ["WIFI", "Wi-Fi"],
  ["WATER_FOUNTAIN", "Water Fountain"],
  ["BALL_INCLUDED", "Ball Included"],
  ["EQUIPMENT_RENTAL", "Equipment Rental"],
  ["FIRST_AID", "First Aid"],
  ["REFEREE_SERVICE", "Referee Service"],
]);

export const amenities: AmenityGroup[] = [
  {
    group: "Comfort & Seating",
    items: [
        { label: "Seating", key: "SEATING", icon: <MdEventSeat /> },
        { label: "Locker Rooms", key: "LOCKER_ROOMS", icon: <GiLockers /> },
        { label: "Showers", key: "SHOWERS", icon: <FaShower /> },
        { label: "Toilets", key: "TOILETS", icon: <FaToilet /> },
        { label: "Cafeteria", key: "CAFETERIA", icon: <IoFastFood /> },
    ],
  },
  {
    group: "Climate & Environment",
    items: [
        { label: "Lighting", key: "LIGHTING", icon: <MdLightbulb /> },
        { label: "Air Conditioned", key: "AIR_CONDITIONED", icon: <FaSnowflake /> },
        { label: "Heating", key: "HEATING", icon: <MdOutlineFireplace /> },
        { label: "Sound System", key: "SOUND_SYSTEM", icon: <MdOutlineSpeaker /> },
    ],
  },
  {
    group: "Accessibility & Utilities",
    items: [
        { label: "Parking", key: "PARKING", icon: <FaParking /> },
        { label: "Wi-Fi", key: "WIFI", icon: <FaWifi /> },
        { label: "Water Fountain", key: "WATER_FOUNTAIN", icon: <MdWaterDrop /> },
    ],
  },
  {
    group: "Sports Equipment",
    items: [
        { label: "Ball Included", key: "BALL_INCLUDED", icon: <FaFutbol /> },
        { label: "Equipment Rental", key: "EQUIPMENT_RENTAL", icon: <GiWhistle /> },
    ],
  },
  {
    group: "Safety & Staff",
    items: [
        { label: "First Aid", key: "FIRST_AID", icon: <FaFirstAid /> },
        { label: "Referee Service", key: "REFEREE_SERVICE", icon: <GiPerson /> },
    ],
  },
];

export const allowedStates = ["LIVE", "ARCHIVED"];

export type PitchType = Partial<PitchDetails> & {
  layout: PitchLayout | null;
  schedule: PitchScheduleItem[];
  settings: Partial<PitchSettings> | null;
};

export interface PitchDetails {
  id: string;
  name: string;
  basePrice: number;             // Base price per hour or slot
  description: string;
  googleMapsLink: string;
  latitude: number;
  longitude: number;
  country: string;
  city: string;
  area: string;
  street: string;
  taxId: string | null;
  ownerId: string;
  images: string[]; // array of image URLs or keys
  amenities: Amenity[];
  isFeatured: boolean;
  status: PitchStatus; // add other possible statuses if known
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
};

export interface PitchSettings {
  id: string;
  pitchId: string;
  paymentDeadline: number;
  advanceBooking: number;        // How many hours in advance a booking can be made
  automaticBookings: boolean;    // Whether bookings are auto-approved
  cancellationGrace: number;     // Grace period in hours
  cancellationFee: number;       // Fee charged on cancellation
  depositFee: number | null;     // Deposit amount if required
  maxBookingHours: number;       // Maximum hours per booking
  minBookingHours: number;       // Minimum hours per booking
  noShowFee: number;             // Fee for not showing up
  offPeakDiscount: number;       // Percentage discount for off-peak hours
  peakHourSurcharge: number;     // Percentage surcharge for peak hours
  payoutRate: PayoutRate;        // How payouts are scheduled
  payoutMethod: BillingMethod;   // How payouts are handed
  paymentMethods: BillingMethod[];   // How bookings are paid
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
};

interface GroundSettingsType {
  id: string;
  minBookingHours: number | null;
  maxBookingHours: number | null;
  cancellationFee: number | null; // % override
  noShowFee: number | null; // % override
  paymentDeadline: number | null;
  advanceBooking: number | null; // Hours override
  peakHourSurcharge: number | null;
  offPeakDiscount: number | null;
  groundId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroundType {
  name: string;
  id: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  images: string[];
  size: "FIVE" | "SEVEN" | "ELEVEN";
  layoutId: string;
  surfaceType: "FG" | "AG" | "TF" | "HW";
  settings: Partial<GroundSettingsType>;
};

export interface CombinationType {
  name: string;
  id: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  size: "SEVEN" | "NINE" | "ELEVEN";
  layoutId: string;
  surfaceType: "FG" | "AG" | "TF" | "HW";
  grounds: GroundType[];
  settings: Partial<GroundSettingsType>;
}

export interface GroundDraftType {
  name: string;
  description: string;
  price: string;
  id: string;
  images: string[];
  size: "FIVE" | "SEVEN" | "ELEVEN";
  surfaceType: "FG" | "AG" | "TF" | "HW";
  settings: {
    minBookingHours: string;
    maxBookingHours: string;
    cancellationFee: string;
    noShowFee: string;
    paymentDeadline: string;
    advanceBooking: string;
    peakHourSurcharge: string;
    offPeakDiscount: string;
  };
}

export interface CombinationDraftType {
  name: string;
  description: string;
  price: string;
  id: string;
  size: "SEVEN" | "NINE" | "ELEVEN";
  surfaceType: "FG" | "AG" | "TF" | "HW";
  grounds: string[];
  settings: {
    minBookingHours: string;
    maxBookingHours: string;
    cancellationFee: string;
    noShowFee: string;
    paymentDeadline: string;
    advanceBooking: string;
    peakHourSurcharge: string;
    offPeakDiscount: string;
  };
}

export interface PitchLayout {
  combinations: CombinationType[];
  grounds: GroundType[];
};

export interface PitchScheduleItem {
  dayOfWeek: number;
  openTime: number;
  closeTime: number;
  peakHours: number[],
  offPeakHours: number[]
};

export interface ResolvedSettings {
    minBookingHours: number;
    maxBookingHours: number;
    cancellationFee: number;
    noShowFee: number;
    advanceBooking: number;
    peakHourSurcharge: number;
    offPeakDiscount: number;
    paymentDeadline: number;
    cancellationGrace: number;
};
