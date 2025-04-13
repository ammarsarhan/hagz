"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { OwnerNavigation } from "@/components/navigation";
import { useAuthContext } from "@/context/auth";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const { owner } = useAuthContext();
    const [open, setOpen] = useState(true);

    if (!owner) {
        redirect("/");
    }

    return (
        <div className="flex h-screen">
            <OwnerNavigation open={open} setOpen={setOpen}/>    
        {children}
        </div>
    );
}
