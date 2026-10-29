# Listings

A player who booked through the app can list their booking as needing players, and players without a team join it. No money goes through Hagz: each joined player pays at the venue. Built in PR 4.7 of [plan.md](plan.md). Agreed on 2026-10-29.

This is a deliberate exception to "no social features in v1": names, a note, and phone numbers once someone has joined. No chat.

## Rules

- **Who can list:** the customer who booked through the app (`creatorId` is null), while the booking is `CONFIRMED` and hasn't started. Staff-entered bookings and `PENDING`, `HELD` or `UNCONFIRMED` ones can't be listed.
- **How many:** the booker sets `neededPlayers`. The ground's sport and size cap it: a 5-a-side pitch holds 10, so at most 9 others can join. A table in code maps each sport and size to its player count.
- **Raising and lowering:** the booker can raise it at any time up to the cap, and **lower it only down to the number already joined**. Setting it to the joined count closes the listing. Turning the listing off is only possible while nobody has joined, or after removing the joined players.
- **Joining:** any signed-in customer, from the feed or a shared link. Not the booker, not twice, not when it's full, not after kick-off, and not into two games that overlap in time.
- **Leaving:** a joined player can leave until kick-off, which frees their spot. The booker can remove a player, who is told.
- **Cancellation:** if the booking is cancelled, every joined player is notified and the listing closes.
- **Disclaimer,** on the listing and on the join button: *"Hagz doesn't guarantee that the players who join will show up, or that the game will go ahead. Payment is made in person at the venue."*

## What people see

| | Before joining | After joining |
|---|---|---|
| Venue, ground, sport, size, time | Yes | Yes |
| Spots left, and the booker's note | Yes | Yes |
| Booker's first name | Yes | Yes |
| Cost share ("about 100 EGP each, paid at the venue"), if the booker set one | Yes | Yes |
| Other joined players' first names | Count only | Yes |
| The booker's phone number | No | Yes, until 24 hours after kick-off |

The booker sees each joined player's first name, phone number, reliability figure, and when they joined. Phone numbers are only ever shared between the booker and a joined player, never between two joined players. Venue staff see the joined players' names, as a headcount for the booking.

## Finding games

- **Feed:** "Games needing players", using the Phase 3 search: near me or by area, sport, size, date and time. Sorted by soonest, then distance.
- **Link:** the booking's existing share link (`/b/[code]`) shows the listing with a join button when it's open. It opens the app, or the web page that sends people to install it.
- **Notifications** (Phase 7): the booker hears when someone joins or leaves. Joined players get a reminder before kick-off and hear about cancellations and removals. Customers who opt in to "Games near me" can be told about new games matching their sport and area, within the same weekly cap as venue offers.

## Reliability

After the game, the booker has 48 hours to mark joined players who didn't come. Each player then shows **"showed up X of Y games"** on the booking's player list and on their join. Nothing blocks anyone automatically. The booker uses it to decide whether to remove someone.

A reported player sees the report on their game history. Admins can remove a report that looks unfair, and the booker's reports are visible to admins in case someone reports everyone.

## Schema changes

A listing is its own model, not columns on `Booking`. A booking's terms are fixed when it's made, while a listing changes all the time. A separate table also keeps the feed's queries on a small table and leaves room for game features later (skill level, positions, join requests, a minimum reliability).

- **`BookingListing`**, one per booking:
  - `id`, `bookingId` (unique);
  - `venueId` and `startsAt`, copied from the booking so the feed filters and sorts without joining `Booking`. Safe, because a booking's time and venue never change in v1;
  - `status` (`ListingStatus`): `OPEN`, `CLOSED` (the booker turned it off) or `CANCELLED` (the booking was cancelled). Full and started are calculated, not stored;
  - `neededPlayers`;
  - `playerCount`, kept up to date under the same lock as joining, so the feed shows spots left without counting rows;
  - `note?`, `costShare?` (minor units, informational only);
  - `createdAt`, `closedAt?`.

  Indexed on `(status, startsAt)` and `venueId` for the feed.
- **`ListingPlayer`:** `listingId`, `customerId`, `status` (`ListingPlayerStatus`: `JOINED` / `LEFT` / `REMOVED`), `joinedAt`, `leftAt?`, `noShowReportedAt?`. Unique on `(listingId, customerId)`, indexed on `customerId` for "my games".
- **Joining, leaving and changing `neededPlayers` lock the `BookingListing` row**, then check that `playerCount` stays at or under `neededPlayers`. Two players can't both take the last spot, the booker can't lower the number below what's joined, and the booking itself is never locked by people joining.
- **If the booking is cancelled,** its transaction also sets the game to `CANCELLED`.
- **Phase 7:** the "Games near me" opt-in.

## Open

- Whether joined players also become the venue's customers (`VenueCustomer`), so venues can see them in Fill a slot. They play there, but they didn't book.
- Whether a minimum reliability can be required to join (for example, bookers may only accept players who show up at least 80% of the time).
