import { z } from "zod";

// Checking in at the venue (2026-11-22): the booker of an app booking and each joined open-game
// player show a QR code; staff scan it, or tick them in by name, from 15 minutes before kick-off until
// 30 minutes after. It proves who came, for players' reliability and the joining fees.

const Instant = z.iso.datetime();

// The window, shared so the staff app can say when check-in opens before the API has a window to
// return (a booking still waiting to be paid).
export const CHECK_IN_OPENS_BEFORE_MINUTES = 15;
export const CHECK_IN_CLOSES_AFTER_MINUTES = 30;

export const CheckInWindow = z
  .object({
    opensAt: Instant.meta({ description: "15 minutes before kick-off." }),
    closesAt: Instant.meta({ description: "30 minutes after kick-off." }),
    checkedInAt: Instant.nullable(),
  })
  .meta({ id: "CheckInWindow" });

export const CheckInCode = z
  .object({
    code: z.string().meta({ description: "Show it as a QR code. Works for 60 seconds." }),
    expiresAt: Instant,
    refreshAt: Instant.meta({ description: "Fetch a new one by then (30 seconds)." }),
  })
  .meta({ id: "CheckInCode" });

export const ScanCheckIn = z
  .object({ code: z.string().min(1).max(2000).meta({ description: "What the QR code says." }) })
  .meta({ id: "ScanCheckIn" });

export const CheckInPerson = z
  .object({
    customerId: z.uuid(),
    firstName: z.string(),
    role: z.enum(["BOOKER", "PLAYER"]),
    checkedInAt: Instant.nullable(),
    manual: z.boolean().meta({ description: "Ticked in by name, without the code." }),
  })
  .meta({ id: "CheckInPerson" });

// The booking a check-in was for, as the scanner names it: "Mostafa's game · 7 – 9 pm · Pitch 1".
export const CheckInBooking = z
  .object({
    bookerFirstName: z.string(),
    startsAt: Instant,
    endsAt: Instant,
    timezone: z
      .string()
      .meta({ description: "The venue's IANA timezone.", example: "Africa/Cairo" }),
    ground: z.string().nullable().meta({ description: "The ground's name." }),
  })
  .meta({ id: "CheckInBooking" });

export const CheckInResult = z
  .object({
    bookingId: z.uuid(),
    booking: CheckInBooking,
    person: CheckInPerson,
    already: z.boolean().meta({ description: "They had already checked in; nothing changed." }),
  })
  .meta({ id: "CheckInResult" });

export const ManualCheckIn = z
  .object({
    customerId: z.uuid().meta({ description: "The booker's or a joined player's account." }),
  })
  .meta({ id: "ManualCheckIn" });

// What staff see on a booking that takes check-ins.
export const StaffCheckIn = z
  .object({
    opensAt: Instant,
    closesAt: Instant,
    people: z.array(CheckInPerson).meta({ description: "The booker, then joined players." }),
  })
  .meta({ id: "StaffCheckIn" });

export type CheckInWindow = z.infer<typeof CheckInWindow>;
export type CheckInCode = z.infer<typeof CheckInCode>;
export type ScanCheckIn = z.infer<typeof ScanCheckIn>;
export type CheckInPerson = z.infer<typeof CheckInPerson>;
export type CheckInBooking = z.infer<typeof CheckInBooking>;
export type CheckInResult = z.infer<typeof CheckInResult>;
export type ManualCheckIn = z.infer<typeof ManualCheckIn>;
export type StaffCheckIn = z.infer<typeof StaffCheckIn>;
