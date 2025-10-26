"use client";

import { FormContextProvider } from "@/app/context/useFormContext";

import Details, { detailsSchema } from "@/app/dashboard/pitches/create/steps/Details";
import Settings, { settingsSchema } from "@/app/dashboard/pitches/create/steps/Settings";
import Layout, { layoutSchema } from "@/app/dashboard/pitches/create/steps/Layout";
import Schedule, { scheduleSchema } from "@/app/dashboard/pitches/create/steps/Schedule";

import { Amenity, CombinationDraftType, GroundDraftType, PitchType } from "@/app/utils/types/pitch";
import Form from "@/app/dashboard/pitches/create/Form";

export default function ProviderWrapper({ draft, index } : { draft?: PitchType, index?: number | undefined }) {
    const data = {
        details: {
            name: "",
            taxId: "",
            description: "",
            street: "",
            area: "",
            city: "",
            country: "EG",
            latitude: "",
            longitude: "",
            googleMapsLink: "",
            images: [] as string[],
            amenities: [] as Amenity[],
            isFeatured: false,
            basePrice: "150"
        },
        settings: {
            automaticBookings: "Yes",
            minBookingHours: "1",
            maxBookingHours: "2",
            cancellationFee: "5",
            noShowFee: "15",
            paymentDeadline: "2",
            advanceBooking: "1",
            peakHourSurcharge: "5",
            offPeakDiscount: "5",
            payoutRate: "MONTHLY",
            allowDeposit: "No",
            depositFee: "20"
        },
        layout: {
            grounds: [] as GroundDraftType[],
            combinations: [] as CombinationDraftType[]
        },
        schedule: [
            {
                dayOfWeek: 0,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            },
            {
                dayOfWeek: 1,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            },
            {
                dayOfWeek: 2,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            },
            {
                dayOfWeek: 3,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            },
            {
                dayOfWeek: 4,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            },
            {
                dayOfWeek: 5,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            },
            {
                dayOfWeek: 6,
                openTime: 0,
                closeTime: 24,
                peakHours: [],
                offPeakHours: []
            }
        ]
    };

    // Handle parsing and populating the data into a valid format from the backed to be parsed on the frontend.
    if (draft) {
        const details = {
            name: draft.name || "",
            taxId: draft.taxId || "",
            description: draft.description || "",
            street: draft.street || "",
            area: draft.area || "",
            city: draft.city || "",
            country: draft.country || "EG",
            latitude: String(draft.latitude || ""),
            longitude: String(draft.longitude || ""),
            googleMapsLink: draft.googleMapsLink || "",
            images: draft.images || [],
            amenities: draft.amenities || [],
            isFeatured: false,
            basePrice: String(draft.basePrice) || "100"
        };

        data.details = details;

        if (draft.settings) {
            const settings = {
                automaticBookings: draft.settings.automaticBookings ? "Yes" : "No",
                minBookingHours: String(draft.settings.minBookingHours),
                maxBookingHours: String(draft.settings.maxBookingHours),
                cancellationFee: String(draft.settings.cancellationFee),
                noShowFee: String(draft.settings.noShowFee),
                paymentDeadline: String(draft.settings.paymentDeadline),
                advanceBooking: String(draft.settings.advanceBooking),
                peakHourSurcharge: String(draft.settings.peakHourSurcharge),
                offPeakDiscount: String(draft.settings.offPeakDiscount),
                payoutRate: draft.settings.payoutRate || "MONTHLY",
                depositFee: typeof draft.settings.depositFee === "number" ? String(draft.settings.depositFee) : "",
                allowDeposit: draft.settings.depositFee ? "Yes" : "No",
            };

            data.settings = settings;
        };

        if (draft.layout) {
            const layout = {
                grounds: draft.layout.grounds.map(ground => {
                    return {
                        name: ground.name,
                        description: ground.description || "",
                        price: String(ground.price || ""),
                        id: ground.id,
                        images: ground.images || [],
                        size: ground.size,
                        surfaceType: ground.surfaceType,
                        settings: {
                            minBookingHours: String(ground.settings.minBookingHours) || "",
                            maxBookingHours: String(ground.settings.maxBookingHours) || "",
                            cancellationFee: String(ground.settings.cancellationFee) || "",
                            noShowFee: String(ground.settings.noShowFee) || "",
                            paymentDeadline: String(ground.settings.paymentDeadline) || "",
                            advanceBooking: String(ground.settings.advanceBooking) || "",
                            peakHourSurcharge: String(ground.settings.peakHourSurcharge) || "",
                            offPeakDiscount: String(ground.settings.offPeakDiscount) || ""
                        }
                    }
                }),
                combinations: draft.layout.combinations.map(combination => {
                    return {
                        id: combination.id,
                        name: combination.name,
                        description: combination.description || "",
                        size: combination.size,
                        surfaceType: combination.surfaceType,
                        grounds: combination.grounds.map(ground => ground.id) || [],
                        price: String(combination.price || ""),
                        settings: {
                            minBookingHours: String(combination.settings.minBookingHours) || "",
                            maxBookingHours: String(combination.settings.maxBookingHours) || "",
                            cancellationFee: String(combination.settings.cancellationFee) || "",
                            noShowFee: String(combination.settings.noShowFee) || "",
                            paymentDeadline: String(combination.settings.paymentDeadline) || "",
                            advanceBooking: String(combination.settings.advanceBooking) || "",
                            peakHourSurcharge: String(combination.settings.peakHourSurcharge) || "",
                            offPeakDiscount: String(combination.settings.offPeakDiscount) || ""
                        }
                    }
                })
            };

            data.layout = layout;
        };
    }

    const steps = [
        {
            title: "Pitch Details",
            description: "Basic information about your pitch name, description, location, and media.", 
            component: <Details/>,
            schema: detailsSchema,
            key: "details"
        },
        {
            title: "Pitch Settings",
            description: "Configure your pitch settings such as pricing, availability, and booking policies.",
            component: <Settings/>,
            schema: settingsSchema,
            key: "settings"
        },
        {
            title: "Pitch Layout",
            description: "Configure your pitch layout and design, grounds and combinations.",
            component: <Layout/>,
            schema: layoutSchema,
            key: "layout"
        },
        {
            title: "Pitch Schedule",
            description: "Set up your pitch schedule, including availability per weekday.",
            component: <Schedule/>,
            schema: scheduleSchema,
            key: "schedule"
        }
    ];

    return (
        <FormContextProvider initial={data} steps={steps} index={index}>
            <Form/>
        </FormContextProvider>
    )
}