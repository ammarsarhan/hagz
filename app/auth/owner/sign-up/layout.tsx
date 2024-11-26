"use client";

import { OwnerFormContextProvider } from "@/context/useOwnerFormContext";
import { PitchContextFormProvider } from "@/context/usePitchFormContext";

export default function CreateOwnerLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OwnerFormContextProvider>
      <PitchContextFormProvider>
        {children}
      </PitchContextFormProvider>
    </OwnerFormContextProvider>
  );
}
