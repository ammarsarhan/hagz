# Rescheduling

How staff move bookings, swap them between customers, and hold slots while they sort something out. Built in PR 4.8 of [plan.md](plan.md). Agreed on 2026-10-29, because staff will need this constantly from the first day of testing.

Without it, staff would cancel and re-create bookings by hand. That applies the cancellation policy to what is really a move, leaves payments on the old booking, makes app bookings commission-free (staff-entered bookings have none), loses the history, and frees the slots for a moment so someone else can take them.

## Decisions

- **Staff only** in v1, with `bookings: manage`. Customers who want a change call the venue. Self-service can come after testing.
- **A move is a new booking linked to the old one.** The old booking ends `RESCHEDULED`; it's never edited, because a booking's terms are fixed when it's made.
- **One link table, `Rescheduling`,** for every "this booking came from that one": `MOVE`, `SWAP` and `REFILL` (a released reservation re-sold by someone else; strictly not a reschedule, but the same "came from" link, so it lives here and replaces the earlier `refilledId`).
- **The new booking costs the new slots' prices.** The difference is recorded on the move.
- **Staff holds last `staffHoldMinutes`,** a venue setting (5–60, default 15).

## Moving a booking

Staff pick a booking and a new time, ground, or both.

**Picking a free target holds it at once.** The moment staff choose target slots that are free, the dashboard creates a staff hold on them (see [Holding slots](#holding-slots)), so nobody can book them while staff confirm with the customer. Slots that are already booked need no hold: they're protected by their booking. The hold lasts `staffHoldMinutes`; cancelling the move, or letting it run out, frees the slots.

**Confirming the move**, in **one transaction**, the server:
1. Locks the booking and the target slots, and checks the target slots are free, held by this move's hold, or belong to the other booking in a swap. A hold is released in the same transaction, so there's no moment between releasing it and moving where an app booking could take the slots.
2. Creates the new booking:
   - **same customer**, status, regular and notes;
   - **the original's terms:** commission rate, payment mode and cancellation policy. Moving an app booking keeps its commission;
   - **the new slots' prices,** with new charge lines.
3. Moves the slots to the new booking, and frees the old slots that aren't reused.
4. Sets the old booking to `RESCHEDULED`.
5. Writes a `Rescheduling` row (`MOVE`, the staff member, an optional reason, `priceDifference` = new total − old total) and a `BookingEvent` on each booking.
6. **Brings along what hangs off the booking:** a `BookingListing` is re-pointed to the new booking with the new start time, and its joined players are told.
7. Notifies the customer: "Your booking moved to Thursday 10pm."

The slots are never free in between, so nobody else can take them mid-move.

**Which bookings can move:** `PENDING`, `HELD`, `UNCONFIRMED` and `CONFIRMED`, before they start. A move must respect the ground's minimum and maximum slots.

## Swapping two bookings

A swap is two moves in one transaction: A takes B's time, and B takes A's. A plain swap needs no hold, because both slots are booked until the moment they change hands. If one side moves into a free slot instead (A takes B's time, B moves to an empty hour), that free slot is held when it's picked, as for any move. Both `Rescheduling` rows share a `groupId`, so "show this swap" or "undo this swap" is one query. Both customers are told. Each new booking keeps its own customer's terms and gets the price of its new slots.

## Holding slots

When staff are on the phone with someone who's deciding, they **hold** the slots: a staff-created booking in `HELD` for that customer, with `expiresAt` set `staffHoldMinutes` ahead. To everyone else the slots are taken.

- **Confirm** turns it into a `CONFIRMED` booking.
- **Extend** pushes `expiresAt` once more by `staffHoldMinutes`.
- **Release** frees the slots at once.
- **Nothing happens:** the expiry sweeper frees the slots when it expires, as with unpaid holds.

A staff hold needs no online payment. It's created by staff (`creatorId`), so it carries no commission, like any booking staff enter.

## Money

Recorded now; settled with Phase 6:
- `priceDifference` on each move says what's owed or refunded. At a cash venue, staff settle it in person.
- Payments, deposits and refunds stay attached to the booking they were made on. The chain of `Rescheduling` rows connects them to the current booking, so the balance is the sum along the chain. Phase 6 decides how online deposits follow a move, how a price difference is charged or refunded online, and what happens to loyalty stamps and discounts.

## Refills

When someone books a slot a regular released, the new booking gets a `Rescheduling` row of type `REFILL` from the released reservation, with no `priceDifference`, and `staffId` set only if staff entered it. Recovered revenue for a venue is its `REFILL` moves (indexed on `venueId, type, createdAt`). See [regulars.md](regulars.md#filling-released-slots).

## Schema

- **`Rescheduling`:** `venueId`, `fromBookingId`, `toBookingId`, `type` (`MOVE` / `SWAP` / `REFILL`), `groupId?` (exactly for `SWAP`), `staffId?`, `reason?`, `priceDifference?` (exactly when not `REFILL`), `createdAt`. Both bookings are in the move's venue (composite foreign keys). A booking has at most one origin (unique on `toBookingId`), and a moved or swapped booking has exactly one successor (a partial unique index on `fromBookingId` for `MOVE` and `SWAP`). A released reservation can still be refilled by several bookings, for example two customers taking one hour each of a two-hour slot. Append-only.
- **`BookingStatus`:** `RESCHEDULED`.
- **`VenueSettings.staffHoldMinutes`:** 5–60, default 15.
