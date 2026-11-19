# Listings

A player who booked through the app can list their booking as needing players, and players without a team join it. The booking is always prepaid. Each player who joins owes the booker their share in cash, plus a 10% joining fee that the venue collects for Hagz (see [Money](#money)). Built in PR 4.7 of [plan.md](plan.md). Agreed on 2026-10-29; the money changed on 2026-11-19.

Open games share names, a note, and phone numbers once someone has joined. No chat. Communities can also list games for their members only (see [communities.md](communities.md)).

## Rules

- **Who can list:** the customer who booked through the app (`creatorId` is null), while the booking is `CONFIRMED`, **fully paid online**, and hasn't started. At a deposit venue the booker pays the rest online first; cash-only venues can't host open games. Staff-entered bookings and `PENDING`, `HELD` or `UNCONFIRMED` ones can't be listed. The fully-paid check lands with online payments (5.2). Until then, which is before launch, any confirmed app booking can be listed.
- **How many:** the booker sets `neededPlayers`. The ground's sport and size cap it: a 5-a-side pitch holds 10, so at most 9 others can join. A table in code maps each sport and size to its player count.
- **Raising and lowering:** the booker can raise it at any time up to the cap, and **lower it only down to the number already joined**. Setting it to the joined count closes the listing. Turning the listing off is only possible while nobody has joined, or after removing the joined players.
- **Joining:** any signed-in customer, from the feed or a shared link. Not the booker, not twice, not when it's full, not after kick-off, and not into two games that overlap in time.
- **Leaving:** a joined player can leave until kick-off, which frees their spot. The booker can remove a player, who is told.
- **Cancellation:** if the booking is cancelled, every joined player is notified and the listing closes.
- **Rescheduling:** if staff move the booking, the listing moves with it (new booking and start time) and joined players are told. See [rescheduling.md](rescheduling.md).
- **Disclaimer,** on the listing and on the join button: *"Hagz doesn't guarantee that the players who join will show up, or that the game will go ahead. You pay your share to the booker and the joining fee to the venue, in person."*

## What people see

| | Before joining | After joining |
|---|---|---|
| Venue, ground, sport, size, time | Yes | Yes |
| Spots left, and the booker's note | Yes | Yes |
| Booker's first name | Yes | Yes |
| Share and joining fee ("60 EGP to Ahmed + 6 EGP at the venue") | Yes | Yes |
| Other joined players' first names | Count only | Yes |
| The booker's phone number | No | Yes, until 24 hours after kick-off |

The booker sees each joined player's first name, phone number, reliability figure, and when they joined. Phone numbers are only ever shared between the booker and a joined player, never between two joined players. Venue staff see the joined players' names, as a headcount for the booking.

## Finding games

- **Feed:** "Games needing players", using the Phase 3 search: near me or by area, sport, size, date and time. Sorted by soonest, then distance.
- **Link:** the booking's existing share link (`/b/[code]`) shows the listing with a join button when it's open. It opens the app, or the web page that sends people to install it.
- **Notifications** (Phase 7): the booker hears when someone joins or leaves. Joined players get a reminder before kick-off and hear about cancellations and removals. Customers who opt in to "Games near me" can be told about new games matching their sport and area, within the same weekly cap as venue offers.

## Money

Agreed on 2026-11-19.

- **The booker has prepaid the whole booking**, so the venue is never short, whoever turns up.
- **The share** is the booking's total divided by the ground's player count, rounded up to a whole currency unit. It's copied onto the listing when it opens. Example: 600 EGP on a 5-a-side pitch (10 players) is 60 EGP each. The booker's own spot and any spots left unfilled stay paid for by the booker.
- **The joining fee** is 10% of the share, rounded to a whole unit: 6 EGP in the example. The rate is `Marketplace.joinFeeRate` (basis points, 1000 by default), copied onto the listing.
- **At the venue,** the joined player pays the booker their share (60 EGP) and pays the venue the joining fee (6 EGP). The game page and the join button show both amounts and who each one is paid to.
- **Staff check joined players in** from the booking's player list. Checking a player in records that the venue took their fee. Hagz takes the fee out of the venue's balance (a `JOIN_FEE` ledger entry), settled at the next payout. It works the same way as commission on cash bookings.
- **A player who doesn't come pays nothing,** and Hagz accepts the loss: they're a small part of a booking that's already paid. Leaving or being removed costs nothing either, because nothing is paid in advance.
- **The audit compares the two attendance records:** the venue's check-ins and the booker's no-show reports. A player the booker says came but the venue never checked in is flagged to admins, because that's where a fee could go missing.

## Reliability

After the game, the booker has 48 hours to mark joined players who didn't come. Each player then shows **"showed up X of Y games"** on the booking's player list and on their join. Nothing blocks anyone automatically. The booker uses it to decide whether to remove someone.

A reported player sees the report on their game history. Admins can remove a report that looks unfair, and the booker's reports are visible to admins in case someone reports everyone.

## Schema changes

A listing is its own model, not columns on `Booking`. A booking's terms are fixed when it's made, while a listing changes all the time. A separate table also keeps the feed's queries on a small table and leaves room for game features later (skill level, positions, join requests, a minimum reliability).

- **`BookingListing`**, one per booking:
  - `id`, `bookingId`, unique together with `venueId`, so there's one listing per booking and the copied venue is the booking's own;
  - `venueId` and `startsAt`, copied from the booking so the feed filters and sorts without joining `Booking`. Safe, because a booking's time and venue never change: a reschedule creates a new booking, and the same transaction re-points the listing and updates its `startsAt`;
  - `status` (`ListingStatus`): `OPEN`, `CLOSED` (the booker turned it off) or `CANCELLED` (the booking was cancelled). Full and started are calculated, not stored;
  - `neededPlayers`;
  - `playerCount`, kept up to date under the same lock as joining, so the feed shows spots left without counting rows;
  - `note?`;
  - `sharePrice` and `joinFeeRate`, copied when the listing opens (changed on 2026-11-19: replaces the informational `costShare?`). A reschedule keeps them, like the booking's other terms;
  - `communityId?` and `publicAt?`, for community games (see [communities.md](communities.md));
  - `createdAt`, `closedAt?`.

  Indexed on `(status, startsAt)` and `venueId` for the feed.
- **`ListingPlayer`:** `listingId`, `customerId`, `status` (`ListingPlayerStatus`: `JOINED` / `LEFT` / `REMOVED`), `joinedAt`, `leftAt?`, `noShowReportedAt?`. Since 2026-11-19 also `feeAmount` (copied at join) and `checkedInAt?` with `checkedInById?` (the staff member who took the fee; CHECK: both or neither, and only for `JOINED`). Its primary key is `(listingId, customerId)`, so rejoining reuses the row; indexed on `customerId` for "my games".
- **Joining, leaving and changing `neededPlayers` lock the `BookingListing` row**, then check that `playerCount` stays at or under `neededPlayers`. Two players can't both take the last spot, the booker can't lower the number below what's joined, and the booking itself is never locked by people joining.
- **If the booking is cancelled,** its transaction also sets the game to `CANCELLED`.
- **`Marketplace.joinFeeRate`:** basis points, default 1000 (10%).
- **`LedgerEntry` type `JOIN_FEE`:** one per checked-in player, unique on `(listingId, customerId)`, taken from the venue's balance (6.3).
- **`Customer.nearbyGames`:** the "Games near me" opt-in, off by default (used in Phase 7).

## Open

- Whether the venue keeps part of the joining fee for collecting it. It has to chase strangers for 6 EGP, and a share would make it more likely to check players in.
- VAT on the joining fee: it's Hagz's revenue, so Hagz charges VAT on it once registered (the accountant's question, with commission).

- Whether joined players also become the venue's customers (`VenueCustomer`), so venues can see them in Fill a slot. They play there, but they didn't book.
- Whether a minimum reliability can be required to join (for example, bookers may only accept players who show up at least 80% of the time).
