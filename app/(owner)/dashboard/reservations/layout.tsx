"use client"

import { ReservationContextProvider } from '@/context/useReservationContext';

export default function ReservationLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReservationContextProvider>
        {children}
    </ReservationContextProvider>
  );
}
