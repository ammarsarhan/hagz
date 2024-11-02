"use client";
import { OwnerFormProvider } from "@/context/useFormContext";

export default function CreateOwnerLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OwnerFormProvider>
        {children}
    </OwnerFormProvider>
  );
}
