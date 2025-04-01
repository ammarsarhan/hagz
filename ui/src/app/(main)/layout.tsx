"use client";

import { OwnerNavigation, UserNavigation } from "@/components/navigation";
import { useAuthContext } from "@/context/auth";
import { useState } from "react";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { owner } = useAuthContext();
  const [open, setOpen] = useState(true);

  return (
    <div className={`flex h-screen ${owner ? "flex-row" : "flex-col"}`}>
      {
        owner ? 
        <OwnerNavigation open={open} setOpen={setOpen}/> : 
        <UserNavigation />
      }
      {children}
    </div>
  );
}
