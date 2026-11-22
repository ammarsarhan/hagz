"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BookingProvider, useCurrentBooking } from "@/admin/bookings/booking";
import { bookingHref, bookingTime, statusLabel, statusTone } from "@/admin/bookings/model";
import { SkeletonText, Tag } from "@/admin/data-table";
import { LinkTabs } from "@/admin/tabs";

// A booking's own page, opened from the Bookings table: a breadcrumb back, the booking's code and
// status, then three tabs, each a page of its own: Details, Payments and History. Laid out as a
// venue's dashboard is.

const TABS = [
  { slug: "details", label: "Details" },
  { slug: "payments", label: "Payments" },
  { slug: "history", label: "History" },
] as const;

export default function BookingLayout({ children }: { children: ReactNode }) {
  const { bookingId } = useParams<{ bookingId: string }>();
  return (
    <BookingProvider bookingId={bookingId}>
      <BookingFrame bookingId={bookingId}>{children}</BookingFrame>
    </BookingProvider>
  );
}

function BookingFrame({ bookingId, children }: { bookingId: string; children: ReactNode }) {
  const { booking, missing, error } = useCurrentBooking();
  const pathname = usePathname();
  const router = useRouter();

  // The booking's own link has no page of its own: it opens on Details.
  const bare = pathname === bookingHref(bookingId);
  useEffect(() => {
    if (bare) router.replace(bookingHref(bookingId, "details"));
  }, [bare, bookingId, router]);

  if (missing) {
    return (
      <>
        <Breadcrumb current="Not found" />
        <p className="mt-6 text-body text-ink-2">There’s no booking at this link.</p>
      </>
    );
  }

  const venueName = booking
    ? (booking.venue.names.en ?? booking.venue.names.ar ?? booking.venue.slug)
    : undefined;

  return (
    <>
      <Breadcrumb current={booking?.code} />
      <header className="mt-4">
        {booking ? (
          <>
            <div className="flex items-center gap-2.5">
              <h1 className="truncate font-mono text-title font-semibold text-ink">
                {booking.code}
              </h1>
              <Tag tone={statusTone(booking.status)}>{statusLabel[booking.status]}</Tag>
            </div>
            <p className="mt-1 text-body text-ink-2">
              {[venueName, booking.ground.name].filter(Boolean).join(" · ")} ·{" "}
              <span className="tabular-nums">
                {bookingTime(booking.startsAt, booking.endsAt, booking.timezone)}
              </span>
            </p>
          </>
        ) : error ? (
          <p className="text-body text-ink-2">{error}</p>
        ) : (
          // The code, then the venue and time under it.
          <>
            <SkeletonText size="title" className="w-40" />
            <SkeletonText size="body" className="mt-1 w-80" />
          </>
        )}
      </header>

      <div className="mt-6">
        <LinkTabs
          label="Booking sections"
          current={pathname}
          items={TABS.map((tab) => ({ href: bookingHref(bookingId, tab.slug), label: tab.label }))}
        />
      </div>

      {bare ? null : <div className="mt-8">{children}</div>}
    </>
  );
}

function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-label">
      <Link href="/admin/bookings" className="text-ink-2 hover:text-ink">
        Bookings
      </Link>
      <span className="text-ink-3">/</span>
      {current ? (
        <span aria-current="page" className="truncate font-mono font-medium text-ink">
          {current}
        </span>
      ) : (
        <SkeletonText size="label" className="w-24" />
      )}
    </nav>
  );
}
