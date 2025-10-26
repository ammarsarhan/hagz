"use client";

import { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Header from "@/app/dashboard/pitch/[id]/(protected)/bookings/Header";
import { BookingContextProvider } from "@/app/context/useBookingContext";
import { fetchPitchState } from "@/app/utils/api/client";
import { useParams } from "next/navigation";

export default function PitchBookingsLayout({ children } : { children: ReactNode }) {
    const queryClient = useQueryClient();
    const params = useParams<{ id: string }>();
    const { id } = params;

    const { data } = useQuery({
        queryKey: ['dashboard', 'pitch', id],
        queryFn: () => fetchPitchState(id),
        initialData: () => queryClient.getQueryData(['dashboard', 'pitch', id])
    });

    return (
        <BookingContextProvider layout={data.layout}>
            <Header/>
            {children}
        </BookingContextProvider>
    )
}