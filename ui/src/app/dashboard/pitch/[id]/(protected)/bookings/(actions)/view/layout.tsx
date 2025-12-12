"use client";

import { ReactNode } from "react";
import Header from "@/app/dashboard/pitch/[id]/(protected)/bookings/(actions)/view/Header";

export default function PitchBookingsViewLayout({ children } : { children: ReactNode }) {
    return (
        <>
            <Header/>
            {children}
        </>
    )
}