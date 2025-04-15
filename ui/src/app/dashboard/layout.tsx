"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { OwnerNavigation } from "@/components/navigation";
import { useAuthContext } from "@/context/auth";
import Breadcrumbs from "@/components/breadcrumbs";

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
          <div className="w-full">
            <Breadcrumbs/>
            {children}
          </div>  
        </div>
    );
}
