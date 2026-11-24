"use client";

import { BookingsTable } from "@/admin/bookings/bookings-table";
import { PageHeader } from "@/admin/page-header";

// Every booking at every venue, to look one up for support. A venue's own are on its Bookings tab.
export default function AdminBookings() {
  return (
    <>
      <PageHeader title="Bookings" subtitle="Every booking at every venue." />
      <div className="mt-6">
        <BookingsTable />
      </div>
    </>
  );
}
