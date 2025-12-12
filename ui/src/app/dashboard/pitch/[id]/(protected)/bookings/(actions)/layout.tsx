"use client";

import { BookingContextProvider } from "@/app/context/useBookingContext";
import { fetchPitchBookingConstraints } from "@/app/utils/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ReactNode } from "react";

export default function PitchBookingsActionsLayout({ children } : { children: ReactNode }) {
    const queryClient = useQueryClient();
    const params = useParams<{ id: string }>();
    const { id } = params;

    const { data } = useQuery({
        queryKey: ['dashboard', 'pitch', id, 'bookings', 'constraints'],
        queryFn: () => fetchPitchBookingConstraints(id),
        initialData: () => queryClient.getQueryData(['dashboard', 'pitch', id, 'bookings', 'constraints'])
    });

    const BookingContextProviderProps = {
        targets: data.targets, 
        settings: data.pitch.settings,
        schedule: data.pitch.schedule
    };

    return (
        <BookingContextProvider {...BookingContextProviderProps}>
            {children}
        </BookingContextProvider>
    )
}