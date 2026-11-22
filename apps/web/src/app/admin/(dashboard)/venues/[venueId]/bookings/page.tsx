"use client";

import { useParams } from "next/navigation";
import { BookingsTable } from "@/admin/bookings/bookings-table";

// A live venue's Bookings tab: its bookings in the same table as the Bookings page, filtered to the
// venue by the API (counts included). A row opens the booking's own page.
export default function VenueBookings() {
  const { venueId } = useParams<{ venueId: string }>();
  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Bookings</h2>
      <p className="mt-1 text-body text-ink-2">
        Every booking at this venue, newest made first. Open one to see its details, payments and
        history.
      </p>
      <div className="mt-8">
        <BookingsTable venueId={venueId} />
      </div>
    </section>
  );
}
