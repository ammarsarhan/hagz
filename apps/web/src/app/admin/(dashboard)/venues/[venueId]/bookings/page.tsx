"use client";

import { useParams } from "next/navigation";
import { BookingsTable } from "@/admin/bookings/bookings-table";
import { useVenueGrounds } from "@/admin/venues/grounds";

// A live venue's Bookings tab: its bookings in the same table as the Bookings page, filtered to the
// venue by the API (counts included), with dropdowns for one ground and one status. A row opens the
// booking.
export default function VenueBookings() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data } = useVenueGrounds(venueId);
  return <BookingsTable venueId={venueId} grounds={data?.grounds} statusFilter="dropdown" />;
}
