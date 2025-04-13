"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { OwnerNavigation, UserNavigation } from "@/components/navigation";
import { useAuthContext } from "@/context/auth";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { owner } = useAuthContext();
  const [open, setOpen] = useState(true);

  if (owner) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col h-screen">
      {
        owner ? 
        <OwnerNavigation open={open} setOpen={setOpen}/> : 
        <UserNavigation />
      }
      {children}
    </div>
  );
}
