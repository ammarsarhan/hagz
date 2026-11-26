# Regulars

Groups that play at the same time every week. A venue marks them as regulars, Hagz reserves their slot for the coming weeks, and each week is confirmed or released before a deadline. A released slot goes back on sale, and Hagz works to fill it. Built in PR 4.5 of [plan.md](plan.md), with reminders and the waitlist in Phase 7.

The idea came from a venue manager who calls their regulars a day ahead to ask whether they're playing this week.

## Decisions

Agreed on 2026-10-29:

- **In v1.** This replaces "no recurring bookings in v1" for this shape of recurrence: a weekly reservation confirmed each week, never a booking that renews and charges by itself.
- **Two venue settings:** how many weeks ahead reservations are made (`regularHorizon`), and how long before kick-off they must be confirmed (`confirmationWindow`).
- **Priced like any booking:** each weekly reservation copies the slot prices when it's created.
- **Confirmed by staff or by the regular**, straight to `CONFIRMED`. No payment goes through Hagz: the venue collects it, as with cash.
- **No commission** on a regular's own reservations. Hagz earns when it re-sells a slot a regular released.
- **Changing a regular's time or ground** (decided on 2026-10-30): its future `UNCONFIRMED` reservations are released and re-created at the new time, following the top-up rules (a week that's already taken is skipped, and staff are told). `CONFIRMED` ones stay, and staff use Move on them if needed. These releases have their own event type (`REGULAR_CHANGED`), so they don't count against the regular's reliability or the recovered-revenue figures. The customer is told the new time once.

Agreed on 2026-11-22 (PR 4.5):

- **A closed hour:** that week is skipped like a taken one, and the regular carries on by itself once the hour reopens.
- **Missed deadlines:** never paused automatically; they show in the reliability figures only.
- **Pausing or ending** releases the regular's future `UNCONFIRMED` reservations at once (`REGULAR_CHANGED`, not counted against reliability). `CONFIRMED` weeks stay. Resuming reserves again from the next free week.
- **Overlapping regulars are allowed**, with a **priority** that staff set by reordering the regulars that overlap. Lower goes first; a new regular joins at the end. Reordering moves **waiting** weeks: a regular moved down lets its `UNCONFIRMED` weeks go (`REGULAR_CHANGED` with reason `REORDERED`), and the top-up gives them to whoever is first now. A **confirmed** week stays with whoever confirmed it. **Resuming** works the same way: a regular back from a pause takes back the waiting weeks of anyone behind it in line at an overlapping time, and the top-up hands them out in priority order. A **move or swap** (by staff, or the customer moving back or rejecting a move) runs the top-up straight after, so a time a regular's week left goes to the next regular in line at once; the moved regular doesn't take it back, since it already plays that week. A waiting week that's **moved or swapped** gets the deadline of its new time (`confirmationWindow` before the new kick-off, or the kick-off itself if that has passed). If a regular releases a week, the next one in priority gets it straight away, as long as its deadline hasn't passed.
- **Creating a regular whose first weeks are taken** still creates it. The answer lists the weeks it skipped.
- **Prices:** each week copies the slot prices. There's no special weekly price; any deal is given at the counter.

## How it works

**1. The regular.** Staff with `bookings: manage` create a regular from a `VenueCustomer`, so walk-ins and phone customers work as well as app users:
- the ground;
- the weekday and start hour, in the venue's local time;
- the number of slots (the duration);
- a start date and an optional end date.

Staff can pause, resume and end a regular.

**2. Weekly reservations.** For each week inside the horizon, Hagz creates a real `Booking` with the new status **`UNCONFIRMED`**. It claims its slots the same way every booking does, so double bookings stay impossible. To everyone else the hour looks taken. Each reservation:
- links to its regular (`Booking.regularId`);
- copies the slot prices when it's created;
- has `paymentMode = MANUAL` and a commission rate of 0, whatever the venue uses for other bookings;
- has `expiresAt = startsAt − confirmationWindow`. That's the confirmation deadline, enforced by the same expiry sweeper as unpaid bookings.

**3. Topping up.** A job runs daily, and whenever a regular is created or changed. It makes sure each active regular has a reservation for every week up to `regularHorizon` weeks ahead. If a week's slots aren't free (someone else booked them, or staff blocked them), that week is **skipped and staff are told**, never forced.

A regular plays **once a week**. A calendar week (Sunday to Saturday, in the venue's time) that already has a live game of theirs at another time is left alone. That covers a week confirmed before the regular's time changed, and one moved to another day or hour. Changing a Sunday regular to Mondays keeps a confirmed Sunday and doesn't reserve the Monday after it.

A booking of the **customer's own** at exactly a week's time (same ground and hours) **becomes that week** instead of the week being skipped as taken. A staff hold turns into an `UNCONFIRMED` week with the regular's deadline, and a confirmed booking joins as it is. Its history gets a `REGULAR_JOINED` event. Someone else's booking there still skips the week.

**4. Before the deadline:**
- **Confirm**: staff in the dashboard (after calling), or the regular from the reminder. `UNCONFIRMED` → `CONFIRMED`.
- **Release**: staff or the regular, at any time before kick-off, even weeks ahead (Eid, exams, travel). `UNCONFIRMED` → `RELEASED`, and the slots are free at once.
- **Nobody answers**: at the deadline, the sweeper moves it to `RELEASED` and frees the slots.

**One customer, one regular at a time on a ground.** A customer can't have two regulars that share an hour on the same ground and weekday while both run, paused ones included (`REGULAR_OVERLAPS`, user 2026-11-26); once one ends, its hours are free for another. Other customers can overlap: they wait in line behind.

A week goes to the next regular in line **only while its confirmation deadline is still ahead**; after that it goes straight back on sale (user, 2026-11-26). So a week nobody answered is never handed on: by its deadline, kick-off is only `confirmationWindow` away, the next regular would have no time to confirm (and isn't told until reminders exist in Phase 7), and the week was shown to them as taken all along, so a public sale is likelier to fill it (Search marks it "just freed"). This is deliberate, not a missing hand-off: `upcomingWeeks` never reserves a week whose deadline has passed. Revisit once reminders can offer a short last-minute window.

A confirmed reservation is then an ordinary booking: it can be cancelled, completed or marked as a no-show. Hagz took no money, so a cancellation refunds nothing; it only frees the slots and counts against the regular's reliability.

## Filling released slots

The value to the venue is how fast a released slot sells again:

1. **Release early.** The reminder goes out well before the deadline (Phase 7), with one-tap confirm and release. A slot released three days ahead sells far more often than one released at the deadline.
2. **Waitlist.** Customers ask to be told when a venue, ground or time frees up. On release, the waitlist hears first, then people who favorited the venue, then nearby customers who recently searched for that sport and time.
3. **"Just freed" in search.** Released slots near kick-off are marked in discovery. A venue can opt in to its `DISCOUNT` price tier applying automatically to freed slots within a few hours of kick-off.
4. **Recovered revenue.** A booking made through the app for a released slot links to the reservation it replaced with a `REFILL` [`Rescheduling`](rescheduling.md#refills) row. The dashboard shows what regulars released and what Hagz filled: "This month 9 slots were released and Hagz filled 7: EGP 4,200 you'd have lost."
5. **Reliability.** Each regular shows how often they confirmed, released early, released late, let the deadline pass, or didn't show up, so the manager knows who keeps blocking slots.

## Filling a slot from the venue's own customers

Hagz fills released slots with app customers (above). Staff fill them from the people who already play at the venue. Staff pick an empty slot, or open a notification about one, and get a ranked list of customers to contact. Built in PR 4.6, with the staff notifications and offer pushes in Phase 7. Agreed on 2026-10-29.

**Groups, in priority order:**

| Priority | Group | Who | What to offer |
|---|---|---|---|
| 1 | Lapsed regular | A regular whose last booking was more than `lapsedAfter` weeks ago | This slot: win them back |
| 2 | Active regular | A regular who booked within `lapsedAfter` weeks | Another free slot this week near their usual time, as well as this one |
| 3 | Other customers | Everyone else, new customers included | This slot |

**A regular** is either a customer with an active `VenueRegular`, or one with at least `regularBookings` bookings in the last `regularPeriod` weeks. That catches loyal players who book week by week without a standing reservation.

**Nothing is stored as a group.** `VenueCustomer` keeps three counters, updated in the same transaction as each booking change, like `Venue.averageRating` with reviews:
- `lastBookedAt`
- `bookingCount` (completed)
- `noShowCount`

The group is worked out from those and the venue's thresholds whenever staff ask, so it's never stale and a changed threshold applies at once.

**Within a group**, candidates are ordered by:
1. how well the slot fits them: how often they've played on that weekday, at that hour, on that ground or sport;
2. reliability: fewer no-shows rank higher;
3. recency.

**The endpoint:** `GET /v1/staff/venues/{venueId}/slots/{slotId}/candidates`, needing `customers: view`. Each candidate comes with:
- the group, and the reason in plain language ("hasn't played in 4 weeks, usually Thursdays 9pm");
- the last booking and their reliability;
- for active regulars, the other suggested slot;
- their phone, for tap-to-call and tap-to-WhatsApp from the staff member's own phone.

**Contacting candidates:**
- **Staff call or message them** from their own phone. This works for everyone, walk-ins included.
- **Or staff send an offer push** through the app, with a link straight to the slot. Free for Hagz; no WhatsApp offers.
  - Only for app customers who opted in to "Offers from venues I've played at". App store rules treat these as promotional, so the setting is off by default and can be turned off in the app.
  - Capped per customer (for example two offers a week across all venues), so nobody is spammed. Each offer is a `Notification` (type `VENUE_OFFER`), so the cap counts a customer's recent `VENUE_OFFER` notifications, and offers appear in their in-app list.
  - A booking made from an offer is an app booking, so normal commission applies. A booking a staff member takes by phone has none.

**Telling staff:** a staff notification (`SLOT_FILL_SUGGESTION`) that opens the ranked list, sent to the owner and members with `bookings: manage`, in three cases:
- **a regular releases a week**: immediately, with the top candidates;
- **a slot is still empty `fillAlertHours` before kick-off**;
- **a daily digest** each morning in the venue's time zone: today's and tomorrow's empty slots, each with its top candidates.

A venue can switch each of the three off.

## Reminders

Reminders are sent by the system, never by staff. Agreed on 2026-10-29.

**Automatic, in the regular's language:**
1. **The reminder**, `reminderLead` hours before the confirmation deadline (a venue setting, default 24). With the default 24-hour confirmation window, that's 48 hours before kick-off.
2. **One follow-up**, 3 hours before the deadline, if the regular hasn't answered: "your slot will be released at 9pm".

Each goes out as:
- **App users:** push and in-app, with confirm and release actions.
- **Everyone else:** WhatsApp, with a link to a small web page that confirms or releases without signing in.

Both are delayed jobs on the queue, keyed by reservation, so each is sent at most once. A job finds the reservation already confirmed or released and sends nothing.

**Staff can copy a link, not send one.** An unconfirmed reservation has a **Copy link** action that creates a fresh `ReminderToken` link. Staff send it from their own WhatsApp; Hagz sends nothing. Tokens are stored only as a hash, so an earlier link can't be shown again, and each copy creates a new one. Every link for a reservation stops working once it's confirmed or released, so several open links can't confirm it twice. Creating links is rate-limited per reservation.

**The page** is `/regular` (Arabic at `/ar/regular`, the link's language follows the customer's app language, else Arabic), Figma W5. The token rides in the fragment (`#token=…`), so it never reaches a server log or a link preview; the page reads it in the browser and calls the public `POST /v1/confirm-links/week`, `/confirm` and `/release` through the site's `/v1`. It shows the week's booking code on top, for the regular to quote when they call the venue, then I'm playing / Not this week while it waits. After that it says what became of the week and who decided it: playing; let go by the regular; missed (nobody confirmed by the deadline, read from the `RELEASED` event's `by: DEADLINE`); or changed by the venue (released, moved or cancelled by staff, or the regular paused or ended). A link follows the week's own deadline, so a longer Confirm by set after it was copied keeps it working. A link that isn't one of ours, or is cut short, shows "This link doesn't work".

Staff see every reservation's state in the calendar, and who still hasn't answered, so they can call the rest.

## Settings

| Setting | On | Range | Default |
|---|---|---|---|
| `regularHorizon` | `VenueSettings` | 1–12 weeks (inside the 90-day slot horizon) | 4 |
| `confirmationWindow` | `VenueSettings` | 1–168 hours before kick-off | 24 |
| `reminderLead` | `VenueSettings` | Hours before the confirmation deadline to send the reminder, 1–168 | 24 |
| `freedDiscountHours` | `VenueSettings` | Off, or 1–48 hours before kick-off for freed slots to get the `DISCOUNT` tier | Off |
| `lapsedAfter` | `VenueSettings` | 1–12 weeks without a booking | 3 |
| `regularBookings` / `regularPeriod` | `VenueSettings` | Bookings within weeks that make a customer a regular | 3 in 8 |
| `fillAlertHours` | `VenueSettings` | Hours before kick-off to alert about an empty slot | 6 |
| `fillAlertOnRelease`, `fillAlertNearStart`, `fillAlertDigest` | `VenueSettings` | Each on or off | All on |

Staff change them on Venue › Rules › Booking settings (`PATCH /v1/staff/venues/{venueId}/booking-settings`, `venue: manage`), and a change reaches what's already set (user, 2026-11-26):

- **`staffHoldMinutes`:** a hold already running keeps its deadline; holds made or extended from then on use the new length.
- **`confirmationWindow`:** every regular's waiting week gets the new deadline (`startsAt − window`), unless that has already passed, when it keeps the one it had: changing a setting never lets a week go. Weeks the shorter window brings back into reach are reserved at once.
- **`regularHorizon`:** shorter lets go of the waiting weeks beyond it (`REGULAR_CHANGED` with reason `HORIZON`, not counted against the regular), and confirmed ones stay, since the customer said yes to them. Longer reserves the new weeks at once instead of at the nightly top-up.
- **`regularBookings`, `regularPeriod`, `lapsedAfter`:** read by Fill a slot each time it's asked, so they apply straight away to nothing stored.

The routes live in the bookings module (it carries a change on to the reservations); the venues module still owns and writes `VenueSettings`. Reminders, the freed-week discount and the fill alerts aren't on the page until they do something.

## Schema changes

- **`VenueRegular`:** `venueId`, `customerId` (a `VenueCustomer`), `groundId`, `dayOfWeek` (0–6 from Sunday, like schedules), `startHour`, `slotCount`, `startsOn`, `endsOn?`, `pausedAt?`, `creatorId` (staff), timestamps.
- **`BookingStatus`:** add `UNCONFIRMED` and `RELEASED`. A released reservation is kept, not deleted:
  - `Notification.booking` is `onDelete: Restrict`, and every reservation has reminder notifications;
  - the `REFILL` link and the reliability figures need the released row and its `BookingEvent`s;
  - unpaid bookings work the same way (`EXPIRED`, not deleted).

  It's a new status rather than `CANCELLED` (which needs a `Cancellation` with a refund policy) or `EXPIRED` ("not approved or paid in time", which doesn't describe an early release).
- **`Booking`:** `regularId?`. Refills are `Rescheduling` rows of type `REFILL` (see [rescheduling.md](rescheduling.md)).
- **`VenueSettings`:** `regularHorizon`, `confirmationWindow`, `reminderLead`, `freedDiscountHours`, the group thresholds and the fill-alert settings.
- **`VenueCustomer`:** `lastBookedAt`, `bookingCount`, `noShowCount`, kept up to date with each booking change.
- **Used from Phase 7** (already in the schema):
  - **`SlotWaitlist`:** a customer waiting for a time at a venue to free up. `customerId`, `venueId`, `groundId?` (null: any ground), `startsAt` and `endsAt` (the window they'd play in), `lastNotifiedAt?`, `createdAt`. Unique on `(customerId, venueId, groundId, startsAt)`. How it works (agreed on 2026-10-29):
    - When a slot frees up (a regular releases, a booking is cancelled, a hold expires), **everyone** whose window covers it is notified **at once**, by push and in-app. First to book gets it; the rest see it's taken.
    - A missed slot is missed, but the request stays: each later slot that frees up in the window notifies it again, at most once every 30 minutes (`lastNotifiedAt`).
    - The row is removed when the customer books a matching slot, or when the window passes.
    - These are alerts the customer asked for, so they don't need the `venueOffers` opt-in and don't count against the weekly offer cap.
  - **`ReminderToken`:** the single-use link in a regular's WhatsApp reminder, or copied by staff. `bookingId`, `tokenHash` (unique, SHA-256 like other tokens), `expiresAt` (the reservation's deadline), `usedAt?`, `createdAt`. Confirming or releasing through it sets `usedAt`; a used or expired token answers "this reminder has expired".
  - `Customer.venueOffers`, the offers opt-in, off by default.
  - Offers sent need no model: they're `Notification` rows.
