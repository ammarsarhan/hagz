"use client";

import type { AdminBookingDetail } from "@hagz/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCurrentBooking } from "@/admin/bookings/booking";
import { Code } from "@/admin/bookings/event-modal";
import { bookingHref, bookingTime, statusLabel, venueDateTime } from "@/admin/bookings/model";
import { formatMoney } from "@/admin/money";
import { DetailsBlock, DetailsRow } from "@/admin/venues/details-block";
import { venueHref } from "@/admin/venues/sections";

// A booking's Details tab: what was booked and by whom, what it cost when it was made (its terms
// never change), and how it ended if it did. Laid out as a venue's Details are: blocks of rows.

const policyLabel = {
  FLEXIBLE: "Flexible",
  MODERATE: "Moderate",
  STRICT: "Strict",
  CUSTOM: "Venue's own",
};
const paymentLabel = { MANUAL: "At the venue", DEPOSIT: "Deposit online", PLATFORM: "Paid online" };
const tierLabel = { BASE: "Base", PEAK: "Peak", DISCOUNT: "Discount" };
const initiatorLabel = { CUSTOMER: "The player", VENUE: "The venue", ADMIN: "Hagz support" };
const moveLabel = { MOVE: "Moved", SWAP: "Swapped", REFILL: "Refilled a released slot" };

const None = () => <span className="text-ink-3">None</span>;
const Text = ({ children }: { children: ReactNode }) => (
  <span className="text-label text-ink">{children}</span>
);

export default function BookingDetails() {
  const { booking } = useCurrentBooking();
  if (!booking) return null;
  const money = (minor: number) => formatMoney(booking.currency, minor);
  const at = (iso: string) => venueDateTime(iso, booking.timezone);
  const venueName = booking.venue.names.en ?? booking.venue.names.ar ?? booking.venue.slug;

  return (
    <section className="lg:w-2/3 [&>*:first-child]:mt-0">
      <DetailsBlock title="Booking">
        <DetailsRow label="Status">
          <Text>{statusLabel[booking.status]}</Text>
          {booking.expiresAt ? (
            <p className="mt-0.5 text-caption text-ink-3">Expires {at(booking.expiresAt)}</p>
          ) : null}
        </DetailsRow>
        <DetailsRow label="Time">
          <Text>
            <span className="tabular-nums">
              {bookingTime(booking.startsAt, booking.endsAt, booking.timezone)}
            </span>
          </Text>
          <p className="mt-0.5 text-caption text-ink-3">{booking.timezone}</p>
        </DetailsRow>
        <DetailsRow label="Venue">
          <Link href={venueHref(booking.venue.id)} className="text-label text-ink underline">
            {venueName}
          </Link>
        </DetailsRow>
        <DetailsRow label="Ground">
          <Text>
            <span className={booking.ground.deleted ? "line-through" : undefined}>
              {booking.ground.name ?? "Unnamed ground"}
            </span>
          </Text>
        </DetailsRow>
        <DetailsRow label="Made">
          <Text>
            {at(booking.createdAt)},{" "}
            {booking.creator ? `by ${booking.creator.name} (staff)` : "in the app"}
          </Text>
        </DetailsRow>
        <DetailsRow label="Note">
          {booking.note ? <Text>{booking.note}</Text> : <None />}
        </DetailsRow>
        <DetailsRow label="Booking ID">
          <Code>{booking.id}</Code>
        </DetailsRow>
      </DetailsBlock>

      <DetailsBlock title="Customer">
        <DetailsRow label="Name">
          <Text>{booking.customer.name}</Text>
        </DetailsRow>
        <DetailsRow label="Phone">
          {booking.customer.phone ? (
            <Text>
              <span className="tabular-nums">{booking.customer.phone}</span>
            </Text>
          ) : (
            <None />
          )}
        </DetailsRow>
        <DetailsRow label="Account">
          {booking.customer.accountId ? (
            <Code>{booking.customer.accountId}</Code>
          ) : (
            <Text>Walk-in, no account</Text>
          )}
        </DetailsRow>
        <DetailsRow label="Venue's record">
          <Code>{booking.customer.venueCustomerId}</Code>
        </DetailsRow>
      </DetailsBlock>

      <DetailsBlock title="Price">
        {booking.charges.map((charge, i) => (
          <DetailsRow key={i} label={chargeLabel(charge, booking)}>
            <Text>
              <span className="tabular-nums">{money(charge.amount)}</span>
            </Text>
            {charge.taxAmount > 0 ? (
              <p className="mt-0.5 text-caption text-ink-3 tabular-nums">
                Includes {money(charge.taxAmount)} VAT at {charge.taxRate / 100}%
              </p>
            ) : null}
          </DetailsRow>
        ))}
        <DetailsRow label="Total">
          <span className="text-label font-semibold text-ink tabular-nums">
            {money(booking.total)}
          </span>
          <p className="mt-0.5 text-caption text-ink-3 tabular-nums">
            {booking.tax > 0
              ? `Includes ${money(booking.tax)} VAT`
              : "No VAT: the venue has no tax number"}
          </p>
        </DetailsRow>
        <DetailsRow label="Payment">
          <Text>{paymentLabel[booking.paymentMode]}</Text>
          {booking.deposit !== null ? (
            <p className="mt-0.5 text-caption text-ink-3 tabular-nums">
              Deposit {money(booking.deposit)}
            </p>
          ) : null}
        </DetailsRow>
        <DetailsRow label="Paid online">
          <Text>
            <span className="tabular-nums">{money(booking.paid)}</span>
          </Text>
        </DetailsRow>
        <DetailsRow label="Commission">
          <Text>
            <span className="tabular-nums">{booking.commissionRate / 100}%</span>
          </Text>
        </DetailsRow>
      </DetailsBlock>

      <DetailsBlock title="Cancellation policy">
        <DetailsRow label="Policy">
          <Text>{policyLabel[booking.cancellation.policy]}</Text>
          {booking.cancellation.tiers.map((tier) => (
            <p key={tier.hours} className="mt-0.5 text-caption text-ink-3">
              {tier.refundPercent}% back with {tier.hours} hours’ notice
            </p>
          ))}
          <p className="mt-0.5 text-caption text-ink-3">Nothing back with less notice</p>
        </DetailsRow>
        {booking.cancelled ? (
          <>
            <DetailsRow label="Cancelled">
              <Text>
                {initiatorLabel[booking.cancelled.initiator]}, {at(booking.cancelled.at)}
              </Text>
              {booking.cancelled.reason ? (
                <p className="mt-0.5 text-caption text-ink-3">{booking.cancelled.reason}</p>
              ) : null}
            </DetailsRow>
            <DetailsRow label="Refund">
              <Text>
                <span className="tabular-nums">
                  {money(booking.cancelled.refundAmount)} ({booking.cancelled.refundPercent}%)
                </span>
              </Text>
            </DetailsRow>
          </>
        ) : null}
      </DetailsBlock>

      {booking.movedFrom || booking.movedTo.length > 0 ? (
        <DetailsBlock title="Moves">
          {booking.movedFrom ? (
            <DetailsRow label="Came from">
              <MoveLink move={booking.movedFrom} />
            </DetailsRow>
          ) : null}
          {booking.movedTo.map((move) => (
            <DetailsRow key={move.bookingId} label="Replaced by">
              <MoveLink move={move} />
            </DetailsRow>
          ))}
        </DetailsBlock>
      ) : null}
    </section>
  );
}

function MoveLink({ move }: { move: NonNullable<AdminBookingDetail["movedFrom"]> }) {
  return (
    <span className="text-label text-ink">
      {moveLabel[move.type]}:{" "}
      <Link href={bookingHref(move.bookingId, "details")} className="font-mono underline">
        {move.code}
      </Link>
    </span>
  );
}

// "18:00–19:00 · Peak", "Floodlights · per hour".
function chargeLabel(charge: AdminBookingDetail["charges"][number], booking: AdminBookingDetail) {
  if (charge.type === "SLOT" && charge.startsAt) {
    const hour = new Date(charge.startsAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: booking.timezone,
    });
    return charge.tier ? `${hour} · ${tierLabel[charge.tier]}` : hour;
  }
  if (charge.type === "AMENITY" && charge.amenity) {
    const name = charge.amenity.name ?? "Extra";
    return charge.amenity.pricing === "PER_HOUR" ? `${name} · per hour` : name;
  }
  return charge.type === "DISCOUNT" ? "Discount" : "Loyalty reward";
}
