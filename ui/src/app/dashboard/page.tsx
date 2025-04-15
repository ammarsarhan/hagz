"use client";

import { useAuthContext } from "@/context/auth";
import { redirect } from "next/navigation";

export default function Dashboard() {
    const { owner } = useAuthContext();

    if (!owner) {
        redirect("/auth/owner/sign-in");
    };
    
    return (
        <div>
            owner dashboard home
        </div>
    )
}