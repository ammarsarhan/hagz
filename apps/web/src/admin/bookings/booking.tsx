"use client";

import type { AdminBookingDetail } from "@hagz/contracts";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, problemCode, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// The booking a booking page is about: fetched once by its layout and shared with every tab, so
// moving between tabs doesn't fetch it again.

interface CurrentBooking {
  booking?: AdminBookingDetail;
  // A link to a booking that isn't there.
  missing: boolean;
  error?: string;
}

const BookingContext = createContext<CurrentBooking | null>(null);

export function BookingProvider({
  bookingId,
  children,
}: {
  bookingId: string;
  children: ReactNode;
}) {
  const [booking, setBooking] = useState<AdminBookingDetail>();
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/bookings/{id}", { params: { path: { id: bookingId } } }),
    );
    if (result.ok) {
      setError(undefined);
      setBooking(result.data);
      return;
    }
    // A malformed id fails validation before the lookup; to the admin it's the same dead link.
    const code = problemCode(result.error);
    if (code === "BOOKING_NOT_FOUND" || code === "VALIDATION_FAILED") return setMissing(true);
    const text = message(result.error);
    setError(text);
    if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
  }, [bookingId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BookingContext.Provider value={{ booking, missing, error }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useCurrentBooking() {
  const context = useContext(BookingContext);
  if (!context) throw new Error("useCurrentBooking is used outside a booking's page.");
  return context;
}
