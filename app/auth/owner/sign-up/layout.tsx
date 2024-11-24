"use client";
import { OwnerFormProvider } from "@/context/useFormContext";
import { PitchContextProvider } from "@/context/usePitchContext";

export default function CreateOwnerLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OwnerFormProvider>
      <PitchContextProvider>
        {children}
      </PitchContextProvider>
    </OwnerFormProvider>
  );
}
