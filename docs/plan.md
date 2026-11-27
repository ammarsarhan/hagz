# Plan

Every phase of the v1 build, broken into pull requests. The roadmap in [architecture.md](architecture.md#roadmap) is the summary; this is the detail. Each PR goes `feature/*` → `dev` and ships its tests. Each phase ends with its exit check.

## Decisions this plan rests on

Agreed on 2026-10-27, on top of the product and schema decisions already made:

- **The UI is built alongside the API, feature by feature** (changed on 2026-10-29 from "API first, apps after"). Each feature's API PR is followed by its UI PR in the same phase, so problems in the API's shape show up while it's still easy to change. **A phase is done only when its flows are walked through in the real apps** (simulator or browser), not just tested.
- **Admin tools ship with each phase**, not as a separate back office at the end. Each phase lists its admin slice. Support promises made earlier (owner password resets through support, admin authenticator resets) are covered in Phase 2.
- **Venues go live through admin review:** `DRAFT` → `SUBMITTED` → `PROVISIONING` → `LIVE`, with `MAINTENANCE` for temporary pauses.
- **Media goes to Cloudflare R2** through a `StorageProvider` (like `MessagingProvider`), with presigned uploads.
- **Discovery is Postgres only:** PostGIS for distance, `pg_trgm` and full-text search for names, indexed `GroundSlot` for availability. No separate search engine, so availability is always exact.
- **Every v1 feature ships before launch**, loyalty, reviews and discounts included.
- **Social features are v1** (decided on 2026-11-19, replacing "no social features in v1"): open games, communities and tournaments, built straight after bookings in Phase 4b. Still no chat or posts. Training academies are out of v1.
- **A booking's share link is `/booking/[code]`** (decided on 2026-11-23, replacing `/b/[code]`). The customer app's universal links already claim `/booking/*`, so the link opens the app when it's installed and the web page otherwise, with no second prefix to register. The route is `ROUTES.sharedBooking` in `@hagz/contracts`.
- **Hagz charges players a service fee on app bookings** (decided on 2026-11-23): 1 EGP per player per hour of the booking, for every player the ground takes (10 EGP an hour on a 5-a-side pitch, 14 on 7-a-side, 22 on 11-a-side; `Marketplace.serviceFee` in minor units, `PLAYERS_BY_GROUND` for the players). It's a `SERVICE_FEE` line on the booking's charges, so the quote and the total include it. VAT is included at the marketplace's rate even when the venue has no tax number, since the fee is Hagz's own revenue. Bookings staff enter, and regulars' weekly reservations, pay no fee. While payment is in cash at the venue, the venue collects it with the booking and Hagz takes it at payout (with commission, which isn't charged on the fee). Hagz keeps the fee when the player cancels (only the venue's part follows the refund tiers); when the venue cancels, the player gets everything back, the fee included. A move by the venue leaves the fee as it was booked. An open game's player share splits it too, since the share is the booking's total over its players.
- **Hosting stays platform-agnostic until Phase 9** (added on 2026-11-08). Staging is on Railway and a VPS is being considered for production. The app is written against the host contract in [deployment.md](deployment.md), and nothing new depends on Railway.
- **The Expo apps run as development builds, made with EAS Build** (changed on 2026-11-13 from Expo Go). Each app's `eas.json` has `development` (the dev client, against a local Metro), `preview` (staging) and `production` profiles. Native modules outside Expo Go are fair game: Google Maps on both platforms now, and a native Paymob SDK is an option for 5.1. A new native module or config plugin means a new development build; JavaScript changes don't. **EAS builds are capped at 14 a month** (added on 2026-11-13), so native changes are planned and batched: see [Native builds](#native-builds).
- **Payments: Paymob, through its styled embedded card fields** (Pixel or a native SDK). The card number goes from the device to Paymob and never reaches Hagz, so PCI scope stays at SAQ A. Hagz designs the checkout; Paymob owns the card inputs.

## Native builds

Added on 2026-11-13. The EAS plan allows **14 builds a month**, and each platform counts as one build. A development build holds only the native layer; screens, styles, pure-JS packages and `EXPO_PUBLIC_*` values reach it from Metro. So a build is needed only when the **native fingerprint** changes: a package with native code added, removed or upgraded; an Expo SDK or React Native bump; a config plugin or its options (permission text, splash, locales); native fields in `app.config.ts` (bundle id, scheme, associated domains, intent filters); icons and splash images; the EAS variables `app.config.ts` reads (the Maps keys); a patch that touches native files.

### Rules

- **Build locally first. EAS is the fallback.** iOS is built locally in Xcode (free Apple ID) and never uses EAS for development. Android is built locally (`expo run:android`, or `eas build --local`) once Android Studio is set up; until then, Android development builds are the only EAS builds. EAS is for `preview` and `production` builds, and for anything that can't be built locally.
- **One native baseline per app, installed up front.** Every native module the plan already needs goes into each app in one batch (below), with its permission text, so the phases after it are JavaScript only. A module that's in the build but not used yet costs nothing.
- **The native layer is frozen between baselines.** No Expo SDK or React Native upgrades until Phase 10 unless a bug forces one, and then they're batched with any other native change that's waiting. Patch bumps of `expo-*` packages wait too.
- **Prefer a JavaScript option** when one is good enough (React Native's own `Share`, `Linking`, JS-only libraries). A new native dependency mid-phase needs a reason in its PR, and goes to the next scheduled build instead of triggering its own.
- **Every PR says whether it needs a build.** Each app keeps the fingerprint of its current build in `apps/<app>/native-fingerprint.json` (from `npx @expo/fingerprint`), and CI flags a PR whose fingerprint doesn't match. A PR that changes it says so in its description and is merged together with the other native changes waiting.
- **Keep two builds in reserve** each month for mistakes (a wrong key, a failed build, a plugin option missed).

### Baselines

| Build | When | Native contents |
|---|---|---|
| Dashboard baseline | Before the rest of Phase 2's UI (photos, layout editor) | Already in: Maps, location, localization, secure store, SVG, splash, and Reanimated, Worklets and Gesture Handler (through NativeWind; enough for the layout editor, bottom sheets and Phase 4's calendar gestures). Adds: `expo-image-picker` (photo library and camera permission text), `expo-image-manipulator` (resizing before upload, [onboarding.md](onboarding.md)), `expo-image`, Rive (onboarding motion), `expo-haptics`, `expo-clipboard` |
| Customer baseline | At the start of 1.U2 | The same set minus Rive, plus Maps and location (Phase 3 near me), with the customer app's own permission text |
| Payments | After the 5.1 spike decides | `react-native-webview` for Pixel, or the native Paymob SDK; Apple Pay and Google Pay entitlements. One build per app that takes payments |
| Push | Phase 7.1 | `expo-notifications` with FCM (`google-services.json`) and APNs credentials. Both apps. Push on iOS needs the paid Apple developer account |
| Launch | Phase 9 and 10 | Sentry, device attestation (Play Integrity, App Attest), final icons and splash screens, and the SDK upgrade if one is due; then `preview` and `production` builds for both apps |

Roughly, a month with a baseline uses 2 to 4 EAS builds (Android for one or both apps, plus a retry), and a month without one uses none. If a phase needs a native module that isn't listed here, it's added to this table before the work starts.

## Phase 0: Platform ✅
Errors, logging, request ids, timeouts, health and shutdown, transactions, `Clock`, idempotency columns, test harness, OpenAPI docs, CI. Merged in #58 and #59.

## Phase 1: Identity ✅
Customer and staff sign-up, sign-in, sessions, password reset and two-factor. Invite-only admins with TOTP. Staff invitations and the venue policy layer. Rate limits, including the global cap on sign-up codes. Merged in #60.

### Phase 1 UI

The screens came first, because every later screen sits behind sign-in. 1.U0, 1.U1, 1.U2 and 1.U3 are built. 1.U2, the customer app's sign-in, came with the customer app's first native build, before the discovery screens, and was signed off on the phone on 2026-11-27.

| PR | Scope |
|---|---|
| 1.U0 API client | A typed client generated from `openapi.json` (`openapi-typescript` + `openapi-fetch`), shared by the three apps. Token storage (secure storage in the Expo apps), refreshing on `TOKEN_EXPIRED`, signing out on `SESSION_ENDED`, problem+json errors mapped to messages |
| 1.U1 Dashboard auth | Staff sign-up (phone → WhatsApp code → name and password), sign-in, two-factor, password reset (owners are told to contact support; members are warned they'll become read-only). The invitation link screen (`/manage/invite/[code]`) and "my invitations", accept and decline. The venue list, with an empty state until venue creation exists |
| 1.U2 Customer auth | Sign-up, sign-in, two-factor, password reset, sign-out. Guests can browse; signing in is asked for only when it's needed |
| 1.U3 Admin web | The `/v1` proxy in Next.js so the admin cookies are first-party. Admin sign-in, authenticator setup (QR code), the code step, accepting an invitation, and inviting and revoking admins. Rendered and checked in a real browser |

**Done when:** a staff member, a customer and an admin can each sign up or accept an invitation, sign in, and sign out in their app.

## Phase 2: Venues and grounds ✅

Done 2026-11-19: an owner took a venue from sign-up to `LIVE` through admin review in the apps. Merged in #131, #132, #135, #138, #147, #154, #157, #158, #161, #165, #170, #171, #174, #177, #180, #183 and #184.

| PR | Scope |
|---|---|
| 2.1 Reference data | Admin CRUD for marketplaces, the location tree and amenity options, with translations. A seed for Egypt (EG, `+20`, `Africa/Cairo`, EGP, 14% VAT, active), its governorates and cities, and its amenity options (floodlights, which venues can price per hour, parking, changing rooms, showers, café, ball rental), each with an icon from Hagz's own list. Public read endpoints for the location tree and amenities |
| 2.2 Venue creation | Designed in [onboarding.md](onboarding.md). A signed-in staff account creates a `DRAFT` and becomes its `OWNER`: name in one language, a pin from Google Maps (`coordinates`, `placeId`), and the confirmed area. One unfinished venue (`DRAFT`, `SUBMITTED` or `PROVISIONING`) per staff account. The setup checklist endpoint. A permanent random slug. Details, translations, venue settings (notice, auto-confirm, payment mode, deposit, cancellation policy, loyalty) and amenities with prices. Every edit is a `VenueEvent` with previous and new values |
| 2.3 Media | `StorageProvider` with Cloudflare R2 (console/in-memory in development and tests). Presigned uploads, confirm (`PENDING` → `READY`), reorder, delete. Size and type limits. Customer avatars (`avatarKey`; API done 2026-11-18, the screens come with the customer app). A sweeper for uploads never confirmed |
| 2.4 Grounds and schedules | Grounds CRUD, with `Ground.environment` (`INDOOR` / `OUTDOOR` / `COVERED`, already in the schema) (sport, size, surface, tier prices, translations, order), ground settings (min/max slots), the weekly `GroundSchedule` with hour tiers, and copying one ground's schedule to others |
| 2.5 Layout | The cinema grid with fixed footprints per sport and size, orientation, sized non-ground tiles, entrances on the edges. The API checks bounds, overlaps and entrance offsets. Required for multi-ground venues |
| 2.6 Slot generation (API and admin built 2026-11-18; the staff calendar comes with Phase 4's dashboard calendar; the in-app admin alert comes with Phase 7's notifications, the email is sent now) | The BullMQ job, following the slot-generation notes: IANA timezone and DST, hours past midnight, `scheduleVersion`, upsert by `[groundId, startsAt]`, only `AVAILABLE` non-manual slots touched, one job per ground. The nightly roll-forward to 90 days. Staff blocking and manual slots (Eid, Ramadan, match nights). Monitoring: checks every few minutes (stale slots older than ~5 minutes, live grounds generated less than 89 days ahead, live grounds with a schedule but no future slots) and the nightly drift audit. Alerts when a job fails after its last retry, a check fails, or the audit finds drift: an in-app admin notification and an email, at most one open alert per problem per ground |
| 2.7 Go-live review | Designed in [onboarding.md](onboarding.md). Submit and withdraw. Admin queue: approve, reject with a reason (back to `DRAFT`). Provisioning: completing Arabic and English, checking the tax number. Go live, pause and resume. A venue's change history (no revert in v1, user 2026-11-18). Ownership transfer. Every step is a `VenueEvent`, with notifications |
| 2.8 Support tools (built 2026-11-19: API and admin screens) | Admin: suspend and reactivate customers, staff and admins (`AccountStatus`, which revokes sessions), reset an owner's password after checking their identity (a one-time grant the owner uses by phone), reset another admin's authenticator, adjust a venue's commission override. All recorded (`AccountEvent`, and `VenueEvent` for a venue's staff) |

**Screens:** dashboard: create a venue, the setup checklist, details and translations, map pin, photos, amenities, grounds and schedules, the layout editor, settings, submit. Admin web: marketplaces, locations and amenities, the review queue (approve, reject, provision, go live), venue history, and support tools. Clicking a venue in the admin Venues table opens a **venue sub-dashboard** at `/admin/venues/:venueId/…`: its own layout and navigation, scoped to that venue. Its tabs follow its status, and there's no overview: **Application** only while it's a draft, in review or provisioning (the owner's checklist, approve or send back with a reason, what going live needs and the tax number check), and where it opens then; **Details** (what players see, plus the tax number); **Grounds**; **Bookings** and **Finance** only once it's live (it opens on Bookings then); **Team**; **Settings** (how Hagz runs it: pause and resume, the commission override, the cancellation policy); and **History**, which keeps the application's steps. In it, the **Slots** tab (a week of one ground at a time) has **Regenerate** beside its ground picker, which queues a run for that ground (runs for a ground never overlap: each takes a lock on its settings row). The ground modal on the Grounds tab is the ground's details and week only (its generation status was dropped, user 2026-11-19). On Home, a **Jobs** card for every queue (waiting, active, delayed, failed, oldest waiting), when the roll-forward and the drift audit last ran, and failed jobs with their reason and **Retry**.
**Admin slice:** 2.1, 2.6 (regenerate, the Jobs card, alert emails), 2.7, 2.8.
**Done when:** DST property tests pass, generation is idempotent, and an owner takes a venue from sign-up to `LIVE` through admin review **in the apps**.
**Decide at the start:** the open items in [onboarding.md](onboarding.md#open) (photo minimum, phone verification, default cancellation policy).
**Decided 2026-11-19:** going live doesn't wait for slot generation. A venue's run takes about a second, and a live venue with no slots matches no availability search, so it's only missing from results for that second.

## Phase 3: Discovery ✅

Done 2026-11-22: a guest finds a venue and sees its free times in the app, and on the web venue page in English and Arabic; every search shape stays inside its budget on `seed:scale`. Merged in #190, #193, #194, #197, #200, #203, #206 and #209.

| PR | Scope |
|---|---|
| 3.1 Search foundations (built 2026-11-19) | `pg_trgm` and `fold_name()`, the database's copy of the app's name folding (Arabic letter variants and diacritics, Latin case and accents, digits), with a trigram index on venue names; area search uses it too. The GiST index on `Venue.coordinates` already existed. `seed:scale` builds a local database at launch scale (1,000 venues, 5.7M slots) for query-plan checks. **No new availability index:** the existing `(groundId, startsAt)` index keeps every search shape under 10 ms on that data; the covering and partial candidates, and when to add one, are in [Search indexes](architecture.md#search-indexes) |
| 3.2 Venue page (API built 2026-11-19) | Public, guest-readable venue details: translations, photos, amenities, grounds, rating, the cancellation policy as a plain-language summary, payment options, location. Availability for one venue by date, layout-first: which grounds are free at a time, then slots per ground. **Built:** `GET /v1/venues/{slug}` (`LIVE` and paused `MAINTENANCE` venues; anything else is `404 VENUE_NOT_FOUND`) with the saved layout (null until drawn), each ground's cheapest hour, and the policy in plain words in `Accept-Language` (`domain/cancellation-summary.ts`); `GET /v1/venues/{slug}/availability?date=` returns the day's bookable slots (free, on an active ground, after the minimum notice; none while paused), and the app works out which grounds are free at a time from back-to-back slots |
| 3.3 Search (built 2026-11-20, beyond the first slice: every filter, a place required (an area, a point or a name; never the whole country), `PRICE`, `SOONEST`, `RATING` counting a rating only from 5 reviews (`MIN_REVIEWS`, also for a minimum rating) and `BEST_MATCH` (the default; tiers from the signed-in player's cards and history, then closeness, a Bayesian rating and fit, constants in `venue-search.ts`), cards with `justFreed`, `loyalty` and `you`, `GET /v1/venues/spread` and `/coverage`; every shape 6–103 ms on `seed:scale`, the slowest being price sort and best match across Cairo. First slice: `GET /v1/venues` by area subtree, point + radius or name; date, start and hours with a ground free the whole length; sport and size; distance or rating; keyset pages; cards with the next 4 free times and a total. Every shape under 50 ms warm on `seed:scale`, by matching with `EXISTS` and reading free times only for the page) | One endpoint. **Where:** area (location tree), near me (distance from a point, with a radius), or name. **Ground filters:** sport, size, surface, indoor/outdoor/covered, number of grounds. **Venue filters:** price range at the chosen time, amenities (floodlights included), minimum rating, instant confirmation, cash or online payment, flexible cancellation, has loyalty. **Time:** exact start and duration, or any time on a date. **Sort:** distance, price, rating (with a minimum number of reviews), soonest available, best match (the default: the player's earned and open loyalty cards first, then venues they've played at, then loyalty venues, then the rest; see [Search ranking](architecture.md#search-ranking)). **Results:** venue cards with the next few free start times (each with how many grounds are free then), cursor-paginated. Slots freed by a regular near kick-off are marked "just freed" |
| 3.4 Favorites (API built 2026-11-20: `GET /v1/customers/me/favorites`, idempotent `PUT`/`DELETE /v1/customers/me/favorites/{venueId}`; live and paused venues only, ones taken off the list kept as `UNAVAILABLE`; search cards carry `you.favorite`) | Save and remove venues, list favorites |

**Dropped (user, 2026-11-20):** a time window with a duration range (too much to ask of the When sheet for how rarely it's needed); each card's matching grounds (too much for a list card; the free times already count the grounds); a "has discounts" filter (7.4's discount codes are private to the players a venue gives them, so there's nothing public to filter by; it would come back only with public promotions).

**Screens:** customer app: browse by area, near me with a map, search and every filter, the venue page with availability, favorites. Web: `/venue/[slug]` (built 2026-11-21), server-rendered for search engines; the area pages and every page the site links to are Phase 8b. These set the shared web layout, so the `/manage/*` fallback (where an invitation link opens without the app, unstyled since Phase 1) is restyled in it here, with the store badges (built 2026-11-22, in English and Arabic, with the staff favicon).
**Admin slice:** search venues in any status. Hide a live venue (`MAINTENANCE`: Pause on the venue's Settings tab).
**Done when:** every search shape stays inside its query-plan and latency budget on the seeded launch-scale data, and a guest can find a venue and see its free times in the app.

## Phase 4: Bookings

| PR | Scope |
|---|---|
| 4.1 Booking core (API built 2026-11-22: `POST /v1/bookings/quote`, open to guests, and `POST /v1/bookings` with `Idempotency-Key`; slots locked before anything is written, the 100-request race leaves one booking and 99 quick 409s; `Booking_no_overlap` as the backstop; `PENDING` waits for the shorter of 12 hours or kick-off minus the notice, `HELD` for the venue's payment window or 15 minutes. Payment goes through a stand-in provider until Phase 5 (built 2026-11-22): `POST /v1/bookings/{id}/payments` and, outside production, `/v1/dev/payments/{id}/succeed` and `/fail`; a payment that lands after the window is kept but confirms nothing, for Phase 5 to refund) | Claiming slots with one guarded update (no double bookings), min/max slots, minimum notice, the 90-day limit. Charges: slots by tier, amenities, VAT lines. The state machine (`PENDING`, `HELD`, `CONFIRMED`, `EXPIRED`, `COMPLETED`, `NO_SHOW`), `BookingEvent`s, idempotency keys |
| 4.2 Approval and expiry (API built 2026-11-22: a sweep every minute on `[status, expiresAt]`, `SKIP LOCKED` batches; staff `approve` (to `HELD` for the payment window when something is paid online, else `CONFIRMED`) and `decline` (a `VENUE` cancellation, slots freed) before the deadline; `mark` `COMPLETED` or `NO_SHOW` once kicked off, correctable until 24 hours after the end; confirmed games become `COMPLETED` by themselves when they end (user, 2026-11-22), in the same minute's sweep on `[status, endsAt]`) | Staff approve or decline when `autoConfirm` is off. The expiry sweeper releases slots of unapproved or unpaid bookings. Completion and no-show marking |
| 4.3 Venue customers | `VenueCustomer` for walk-ins and phone customers. Staff enter bookings on a customer's behalf (no commission), and they link by phone on sign-up. **API built:** confirmed walk-in/phone bookings with an optional custom total kept as one `ADJUSTMENT` line, either sign, carried through moves and shrunk so a moved total stops at 0 (user, 2026-11-22); the customer list A to Z with name/phone search; staff edit walk-ins' name and number only, plus a staff-only `note` on any customer; a customer's bookings |
| 4.4 Booking views (API built 2026-11-22: `GET /v1/bookings` (`when` upcoming or past) with cursors, moved bookings left out, and `GET /v1/bookings/{id}`; staff `GET /v1/staff/venues/{id}/bookings` by venue-local day (a span up to a week), ground and status, `/bookings/pending`, one booking and its history; the share link `GET /v1/shared-bookings/{code}`, no money or customer, a moved booking pointing to its replacement) | Customer: upcoming and past bookings. Staff: the venue's bookings by day and ground. The shareable booking link (`/booking/[token]`, the API side) |
| 4.5 Regulars | Designed in [regulars.md](regulars.md). Weekly reservations for regular groups: `VenueRegular`, `UNCONFIRMED` and `RELEASED` statuses, the daily top-up job, confirm and release by staff or the regular, release at the deadline by the sweeper. No payment through Hagz and no commission. Settings `regularHorizon` and `confirmationWindow`. Recovered revenue and reliability per regular **API built (2026-11-22):** create/change/pause/resume/end and reorder by priority (overlaps allowed; priority decides only new weeks, a released week passes down), the daily top-up at 02:15 Cairo plus on every change, confirm/release by staff or the app regular until the deadline, missed weeks released in the minute's sweep, reliability per regular. Reminders and `ReminderToken` links stay in Phase 7 |
| 4.6 Fill a slot | Designed in [regulars.md](regulars.md#filling-a-slot-from-the-venues-own-customers). Booking counters on `VenueCustomer`, the group thresholds as venue settings, and the candidates endpoint: lapsed regulars, then active regulars (with another suggested slot), then everyone else, ranked by fit, reliability and recency **API built (2026-11-22):** `bookingCount`/`noShowCount`/`lastBookedAt` (= last game played) recomputed from the customer's bookings in the transaction that completes or marks a game; `GET /v1/staff/venues/{id}/slots/{slotId}/candidates` (customers: view), anyone booked at that time left out, active regulars get another free slot in the next 7 days on their usual weekday; the thresholds, `staffHoldMinutes`, `regularHorizon` and `confirmationWindow` at `GET`/`PATCH /v1/staff/venues/{id}/booking-settings` (apart from the reviewed settings). Staff notifications (`SLOT_FILL_SUGGESTION`) and offer pushes stay in Phase 7 |
| 4.8 Rescheduling (API built 2026-11-22: staff `move` (with `holdId`) and `swap`, holds `POST /holds` and `confirm`, `extend` (once) and `release` (ends `EXPIRED`); the player's `move/accept`, `move/reject` and `move/back`, with `move` on their booking while it's open. Telling the customer by push and WhatsApp waits for 7.1, and listings follow moves once 4.7 exists) | Designed in [rescheduling.md](rescheduling.md). Staff move a booking to another time or ground, or swap two, in one transaction: the old booking ends `RESCHEDULED`, the new one keeps the original's terms at the new slots' prices, and a `Rescheduling` records it (refills use it too). Listings follow the booking. Picking a free target slot holds it automatically until the move is confirmed, and the move releases the hold in the same transaction. The customer is told by push and WhatsApp and can accept, or reject within 24 hours (before kick-off) as a venue cancellation with a full refund, or move it back if the original slots are still free; rejected moves are shown per staff member and per venue (decided 2026-11-22, no approval step). Staff holds: a staff `HELD` booking that expires after `staffHoldMinutes`, with confirm, extend and release |
| 4.7 Listings | Designed in [listings.md](listings.md). A `BookingListing` per listed app booking, with `neededPlayers` capped by the ground's size and only lowered down to the joined count. `ListingPlayer` for joining, leaving and removal under a lock on the listing. The "games needing players" feed and share link, the disclaimer, phone numbers shared after joining, and no-show reports with a reliability figure. Money (2026-11-19): only fully prepaid bookings can be listed; each player owes the booker the share (total ÷ the ground's players), plus a 10% joining fee that the venue collects. The venue sees the booking flagged with the expected players and records how many came. A shortfall against expected is noted, and the fee for that count is taken at payout **API built (2026-11-22):** list, change, turn off and remove players on `/v1/bookings/{id}/listing`; `/v1/games` feed (soonest, then nearest; area, point, sport, size, date), `/games/{id}`, `join`, `leave`, `/games/mine`; asked for at checkout (`CreateBooking.listing`) a game waits (`WAITING`) until the booking is confirmed; it follows moves and swaps and is cancelled with a declined, expired or move-rejected booking; staff see the open game and who owes the fee. **QR check-in (2026-11-22)** replaces the arrived count and no-show reports: `GET /bookings/{id}/check-in-code` and `/games/{id}/check-in-code` (a new code every 30 s), staff `POST /staff/venues/{id}/check-ins` (scan), and check in by name or undo on `/bookings/{id}/check-ins`, from 15 min before kick-off to 30 min after. The fee and reliability count checked-in players, and nothing counts when no joined player was checked in; players per ground in `PLAYERS_BY_GROUND`. Deferred: the fully-paid rule (5.2), cancelling with 6.1's cancellations (call `cancelListings`), the `JOIN_FEE` ledger entry (6.3), notifications (Phase 7) |

**Screens:** customer app: Home, the feed of rails the app opens on (Nearby, Free tonight, Top rated, Instant confirmation, Within budget, New on Hagz, Saved venues, Play again, Most booked this week, Just freed, Games needing players; built here because half of them need bookings), the layout-first booking flow, my bookings (with accepting, rejecting or moving back a booking staff moved), listings (feed, join, leave). Dashboard: the calendar (open games flagged with their expected players; QR check-in replaced recording how many came), approvals, walk-in and phone bookings, regulars and their weekly reservations, Fill a slot, move, swap and hold. Web: the shared booking page (`/booking/[code]`).
**Admin slice:** look up any booking and its events (built 2026-11-22: Bookings in the rail, a table with status tabs, search by code, customer, phone or venue, and Show more; a row opens the booking's page with Details, Payments and History tabs, times in the venue's timezone).
**Done when:** the 100-request race leaves exactly one booking, and a customer books and staff manage it end to end in the apps.

## Phase 4b: Communities and tournaments

Decided on 2026-11-19 to come straight after bookings: it needs listings (4.7) and slots, not payments. Designed in [communities.md](communities.md) and [tournaments.md](tournaments.md).

| PR | Scope |
|---|---|
| 4b.1 Communities | `Community`, `CommunityMember`, `CommunityInvite` and `CommunityEvent`. Create (at most 5 owned), settings, open and closed, join, request, approve and decline, invite links, leave, remove, ban, admins, ownership transfer, archive. `memberCount` kept under a lock on the community. Search by name, area and sport |
| 4b.2 Community games | `BookingListing.communityId` and `publicAt`: members-only games, listed by the community's owner or an admin, that can go public at a set time. Same rules and money as open games. A community's games page, and community games in members' feed |
| 4b.3 Tournaments | Kept minimal, since venue tournaments are still unknown. `Tournament`, `TournamentTeam` and `TournamentPlayer`. Venue tournaments (public) and community tournaments (members only). Join rules set by the organizer as JSON with a Zod schema (approval, squad sizes, minimum reliability), loosen-only once a team has registered. One squad per player per tournament is a unique index, not a rule. The lifecycle, registration, squad invite links, confirmation and withdrawal, under locks on the tournament and team |
| 4b.4 Fixtures and results | `TournamentMatch`. Knockout (with byes) and league, drawn at random. A match's ground and time are for display only: ground time is reserved with existing staff blocks or bookings. Results, penalties, walkovers, bracket advancement in one transaction, and tables calculated on read |

**Screens:** customer app: the Community tab (my communities, discover, tournaments), a community's page (members, games, tournaments, notice, WhatsApp link), creating and running a community, requests and invites, tournament pages (bracket, table, fixtures, teams), registering a team and joining a squad. Staff app: creating and running venue tournaments (join rules, teams, draw, match times, results). Web: `/c/[slug]` and `/t/[code]`, which open the app.
**Admin slice:** look up communities and tournaments, hide and unhide a community with a reason, see a community's or tournament's events.
**Done when:** concurrent joins never pass a community's or a tournament's limits, no community is ever left without an owner, a knockout bracket fills correctly through byes and walkovers, and a venue runs a tournament from draw to final in the apps.
**Later, when real use asks for it:** the parts listed in [tournaments.md](tournaments.md#left-out-until-real-use-asks-for-it), such as groups, waitlists, linking matches to slots, and online entry fees.

## Phase 5: Payments

| PR | Scope |
|---|---|
| 5.1 Paymob spike | Prove the styled card fields inside the Expo app (Pixel in a WebView, or a native SDK), Apple Pay and Google Pay, and wallets. Confirm the PCI scope (SAQ A). A short write-up decides the integration |
| 5.2 Provider adapter | `PaymentProvider`, provider-neutral. Paymob payment intentions for full and deposit payments. `HELD` bookings wait for payment within the payment window |
| 5.3 Webhooks and reconciliation | Verify the HMAC with a timestamp tolerance. Deduplicate and order webhooks. Reconcile against Paymob's records. Kiosk reference payments (Fawry through Paymob) with their grace window |
| 5.4 Cash | Staff record cash payments (`Payment` with `creatorId`) |

**Screens:** customer app: checkout with Paymob's styled card fields, wallets and kiosk references. Dashboard: recording cash.
**Admin slice:** payment lookup, and resolving stuck payments.
**Done when:** the tests for missing, duplicate and out-of-order webhooks pass, and a test-mode payment works from the app.

## Phase 6: Money out

| PR | Scope |
|---|---|
| 6.1 Cancellations | Notice tiers, with the presets (Flexible, Moderate, Strict) defined in code. Cancelling as the customer, the venue (always 100%) or an admin (any refund). Plain-language policy summaries |
| 6.2 Refunds | Refunds through Paymob, with their webhooks and retries |
| 6.3 Ledger and commission | `LedgerEntry` for collections, refunds, commission, joining fees (one per open game, for the players the venue recorded), payouts and adjustments. Commission on what the venue keeps, recorded once at the final state. Cash commission makes the balance negative |
| 6.4 Payouts | Payout destinations (bank, wallet, InstaPay; one active per venue). Payout runs, statuses, the VAT invoice for Hagz's commission |
| 6.5 Nightly audit | The ledger reconciled against payments, refunds and payouts, and joining fees against recorded open-game counts. Any drift alerts |

**Screens:** customer app: cancelling with the policy summary and refund amount. Dashboard: cancellations, refunds, the ledger and earnings, payout destinations and payouts, and a "You owe Hagz" card when the balance is negative. Admin web: payout runs and adjustments, negative balances with "Record settlement".
**Admin slice:** payouts, ledger adjustments, settling negative balances, cancelling with any refund, and each venue's share of open games with no joined player checked in.
**Done when:** the audit shows no drift across randomized simulations.
**Decide at the start:** whether commission is on the VAT-inclusive total or net of VAT, and when it's charged (`COMPLETED` / `NO_SHOW`).

## Phase 7: Engagement

| PR | Scope |
|---|---|
| 7.1 Notifications | The sender on the queue: in-app, push (Expo device tokens), WhatsApp (Meta), email. Text rendered per language at send time, deep links from `links.ts`, retries, deduplicating delivery webhooks. Real Meta WhatsApp and email providers. Sign-up codes move to the queue |
| 7.1b Regulars and the waitlist | Automatic reminders to regulars (`reminderLead` hours before the deadline, plus one follow-up), with confirm and release by push, in-app, or a WhatsApp link that works without signing in. Staff can copy a link to send themselves, never trigger a notification. The waitlist, and "slot freed" notifications to the waitlist, favorites and nearby customers. Fill-a-slot alerts to staff (on release, near kick-off, a daily digest) and offer pushes to opted-in customers, capped per customer. See [regulars.md](regulars.md) |
| 7.2 Loyalty | Punch cards following the loyalty decisions: stamps from completed app bookings, the window, the free booking at checkout capped at two hours, restore rules |
| 7.3 Reviews | One per customer per venue, tied to a completed booking, editable. `averageRating` and `reviewCount` recalculated in the same transaction |
| 7.4 Discounts | Venue discount codes: percent or amount, uses, expiry, revoking |

**Screens:** both apps: the notification inbox and push permission. Customer app: Home's loyalty progress rail and inbox bell, loyalty cards, reviews, discount codes at checkout, the waitlist, offer and nearby-game opt-ins, community and tournament notifications (muting a community). Dashboard: loyalty and discount settings, fill-a-slot alerts. Web: the regular's confirm or release page (reminder link).
**Admin slice:** hiding reviews, notification delivery logs.
**Done when:** notifications survive a Redis outage, and a push reaches a real device.
**Decide at the start:** per-customer limits on a discount code, and whether a code applies to a free loyalty booking.

## Phase 8: Accounts and activity

| PR | Scope |
|---|---|
| 8.1 Profile | Edit name, language, timezone and avatar. Change password while signed in. List sessions and sign out of all devices |
| 8.2 Account deletion | In-app deletion, which Apple requires for apps with sign-up. Anonymize (`deletedAt`, null phone) and keep bookings and money records. Rules for open bookings and unpaid balances |
| 8.3 Venue activity | A staff feed from `VenueEvent`, filtered by type and member |

**Screens:** both apps: profile, sessions and signing out of all devices, deleting the account. Dashboard: the venue activity feed.

## Phase 8b: Web links (user, 2026-11-21; postponed from after Phase 3 so the booking flow comes first)

Every link in the public site's header and footer (`apps/web/src/site/links.ts`, all `null` until their page exists) goes somewhere real, so the site is finished, not a venue page with dead links around it.

| PR | Scope |
|---|---|
| 8b.1 Players | Venues and Find venues (search by area on the web), the area pages for Cairo, Alexandria and Giza, and All cities; Get the app (store badges and a QR); How it works and How booking works; Help |
| 8b.2 Venues | Owners and Hagz for venues; List your venue (into the staff app's sign-up); Book a demo; Venue support |
| 8b.3 Company | About, Contact us, Careers |
| 8b.4 Legal | The real Privacy Policy and Terms, for customers, venues and admins. The preliminary admin pages were removed 2026-11-21, so the admin footer's links are plain text until these exist. Payment providers usually ask for public terms, privacy and refund pages when onboarding a merchant, so if Paymob does, this PR moves ahead of Phase 5 going live; the customer app's sign-up line ("you agree to Hagz's Terms and Privacy Policy") links to them too |
| 8b.5 Arabic and app links | The العربية switch, with the whole site in Arabic, right to left. Universal links cover `/venue/*`, so Book in the app opens the app rather than only its scheme (needs a native build: see [Native builds](#native-builds)) |

**Done when:** no link on the site is `null`, and the site reads correctly in both languages.

## Phase 9: Launch readiness (backend)

- The pre-launch list for the code routes: Cloudflare in front with the origin locked, `CLIENT_IP_HEADER`, alerting on the global code cap, device attestation (Play Integrity, App Attest), a Meta spending alert.
- Observability: Sentry, OpenTelemetry traces, metrics and SLO dashboards.
- Load tests with k6, a security review, a restore drill, runbooks.
- Choose the host (Railway or a VPS) using the criteria in [deployment.md](deployment.md#what-would-decide-it), including a week of staging data on Railway. Remove the remaining Railway coupling in the code. Production on that host, with the API and database in one region.
- Legal: review of the terms and privacy policy written in Phase 8b for the agent model, holding venues' money (payment licensing), ETA e-receipts.

## Phase 10: Store launch

The apps have been built phase by phase, so this phase only finishes them:

- Polish: empty states, loading and error states, accessibility, Arabic right-to-left review, app icons and splash screens.
- Store listings and submissions for both apps (privacy labels, account deletion, push permission text).
- The production cut-over, and the Egypt marketplace switched on.
