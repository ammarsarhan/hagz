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
- **Payments: Paymob, through its styled embedded card fields** (Pixel or a native SDK). The card number goes from the device to Paymob and never reaches Hagz, so PCI scope stays at SAQ A. Hagz designs the checkout; Paymob owns the card inputs.

## Phase 0: Platform ✅
Errors, logging, request ids, timeouts, health and shutdown, transactions, `Clock`, idempotency columns, test harness, OpenAPI docs, CI. Merged in #58 and #59.

## Phase 1: Identity (API ✅, UI next)
Customer and staff sign-up, sign-in, sessions, password reset and two-factor. Invite-only admins with TOTP. Staff invitations and the venue policy layer. Rate limits, including the global cap on sign-up codes. Merged in #60.

### Phase 1 UI (next)

The API is done; the screens come first, because every later screen sits behind sign-in.

| PR | Scope |
|---|---|
| 1.U0 API client | A typed client generated from `openapi.json` (`openapi-typescript` + `openapi-fetch`), shared by the three apps. Token storage (secure storage in the Expo apps), refreshing on `TOKEN_EXPIRED`, signing out on `SESSION_ENDED`, problem+json errors mapped to messages |
| 1.U1 Dashboard auth | Staff sign-up (phone → WhatsApp code → name and password), sign-in, two-factor, password reset (owners are told to contact support; members are warned they'll become read-only). The invitation link screen (`/manage/invite/[code]`) and "my invitations", accept and decline. The venue list, with an empty state until venue creation exists |
| 1.U2 Customer auth | Sign-up, sign-in, two-factor, password reset, sign-out. Guests can browse; signing in is asked for only when it's needed |
| 1.U3 Admin web | The `/v1` proxy in Next.js so the admin cookies are first-party. Admin sign-in, authenticator setup (QR code), the code step, accepting an invitation, and inviting and revoking admins. Rendered and checked in a real browser |

**Done when:** a staff member, a customer and an admin can each sign up or accept an invitation, sign in, and sign out in their app.

## Phase 2: Venues and grounds

| PR | Scope |
|---|---|
| 2.1 Reference data | Admin CRUD for marketplaces, the location tree and amenity options, with translations. A seed for Egypt (EG, `+20`, `Africa/Cairo`, EGP, 14% VAT, active), its governorates and cities, and its amenity options (floodlights, which venues can price per hour, parking, changing rooms, showers, café, ball rental). Public read endpoints for the location tree and amenities |
| 2.2 Venue creation | Designed in [onboarding.md](onboarding.md). A signed-in staff account creates a `DRAFT` and becomes its `OWNER`: name in one language, a pin from Google Maps (`coordinates`, `placeId`), and the confirmed area. One open draft per staff account. The setup checklist endpoint. A permanent random slug. Details, translations, venue settings (notice, auto-confirm, payment mode, deposit, cancellation policy, loyalty) and amenities with prices. Every edit is a `VenueEvent` with previous and new values |
| 2.3 Media | `StorageProvider` with Cloudflare R2 (console/in-memory in development and tests). Presigned uploads, confirm (`PENDING` → `READY`), reorder, delete. Size and type limits. Customer avatars (`avatarKey`). A sweeper for uploads never confirmed |
| 2.4 Grounds and schedules | Grounds CRUD, with `Ground.environment` (`INDOOR` / `OUTDOOR` / `COVERED`, already in the schema) (sport, size, surface, tier prices, translations, order), ground settings (min/max slots), the weekly `GroundSchedule` with hour tiers, and copying one ground's schedule to others |
| 2.5 Layout | The cinema grid with fixed footprints per sport and size, orientation, sized non-ground tiles, entrances on the edges. The API checks bounds, overlaps and entrance offsets. Required for multi-ground venues |
| 2.6 Slot generation | The BullMQ job, following the slot-generation notes: IANA timezone and DST, hours past midnight, `scheduleVersion`, upsert by `[groundId, startsAt]`, only `AVAILABLE` non-manual slots touched, one job per ground. The nightly roll-forward to 90 days. Staff blocking and manual slots (Eid, Ramadan, match nights) |
| 2.7 Go-live review | Designed in [onboarding.md](onboarding.md). Submit and withdraw. Admin queue: approve, reject with a reason (back to `DRAFT`). Provisioning: completing Arabic and English, checking the tax number. Go live, pause and resume. A venue's change history with revert. Ownership transfer. Every step is a `VenueEvent`, with notifications |
| 2.8 Support tools | Admin: suspend and reactivate customers, staff and admins (`AccountStatus`, which revokes sessions), reset an owner's password after checking their identity, reset another admin's authenticator, adjust a venue's commission override. All recorded |

**Screens:** dashboard: create a venue, the setup checklist, details and translations, map pin, photos, amenities, grounds and schedules, the layout editor, settings, submit. Admin web: marketplaces, locations and amenities, the review queue (approve, reject, provision, go live), venue history with revert, and support tools.
**Admin slice:** 2.1, 2.7, 2.8.
**Done when:** DST property tests pass, generation is idempotent, and an owner takes a venue from sign-up to `LIVE` through admin review **in the apps**.
**Decide at the start:** the open items in [onboarding.md](onboarding.md#open) (photo minimum, phone verification, default cancellation policy).

## Phase 3: Discovery (new)

| PR | Scope |
|---|---|
| 3.1 Search foundations | A migration with `pg_trgm`, a GiST index on `Venue.coordinates`, an availability index on `GroundSlot` (`(groundId, startsAt) INCLUDE (status, price, tier)` or what the query plans show), and Arabic and English name normalization (Arabic letter variants and diacritics, Latin case and accents). Seed data at launch scale (about 1,000 venues and 5.8M slots) for query-plan checks |
| 3.2 Venue page | Public, guest-readable venue details: translations, photos, amenities, grounds, rating, the cancellation policy as a plain-language summary, payment options, location. Availability for one venue by date, layout-first: which grounds are free at a time, then slots per ground |
| 3.3 Search | One endpoint. **Where:** area (location tree), near me (distance from a point, with a radius), or name. **Ground filters:** sport, size, surface, indoor/outdoor/covered, number of grounds. **Venue filters:** price range at the chosen time, amenities (floodlights included), minimum rating, instant confirmation, cash or online payment, flexible cancellation, has loyalty, has discounts. **Time:** exact start and duration, a window with a duration range, or any time on a date. **Sort:** distance, price, rating (with a minimum number of reviews), soonest available, best match. **Results:** venue cards with their matching grounds and the next few free start times, cursor-paginated. Slots freed by a regular near kick-off are marked "just freed" |
| 3.4 Favorites | Save and remove venues, list favorites |

**Screens:** customer app: browse by area, near me with a map, search and every filter, the venue page with availability, favorites. Web: `/venue/[slug]` and area pages, server-rendered for search engines.
**Admin slice:** search venues in any status. Hide a live venue (`MAINTENANCE`).
**Done when:** every search shape stays inside its query-plan and latency budget on the seeded launch-scale data, and a guest can find a venue and see its free times in the app.

## Phase 4: Bookings

| PR | Scope |
|---|---|
| 4.1 Booking core | Claiming slots with one guarded update (no double bookings), min/max slots, minimum notice, the 90-day limit. Charges: slots by tier, amenities, VAT lines. The state machine (`PENDING`, `HELD`, `CONFIRMED`, `EXPIRED`, `COMPLETED`, `NO_SHOW`), `BookingEvent`s, idempotency keys |
| 4.2 Approval and expiry | Staff approve or decline when `autoConfirm` is off. The expiry sweeper releases slots of unapproved or unpaid bookings. Completion and no-show marking |
| 4.3 Venue customers | `VenueCustomer` for walk-ins and phone customers. Staff enter bookings on a customer's behalf (no commission), and they link by phone on sign-up |
| 4.4 Booking views | Customer: upcoming and past bookings. Staff: the venue's bookings by day and ground. The shareable booking link (`/booking/[token]`, the API side) |
| 4.5 Regulars | Designed in [regulars.md](regulars.md). Weekly reservations for regular groups: `VenueRegular`, `UNCONFIRMED` and `RELEASED` statuses, the daily top-up job, confirm and release by staff or the regular, release at the deadline by the sweeper. No payment through Hagz and no commission. Settings `regularHorizon` and `confirmationWindow`. Recovered revenue and reliability per regular |
| 4.6 Fill a slot | Designed in [regulars.md](regulars.md#filling-a-slot-from-the-venues-own-customers). Booking counters on `VenueCustomer`, the group thresholds as venue settings, and the candidates endpoint: lapsed regulars, then active regulars (with another suggested slot), then everyone else, ranked by fit, reliability and recency |
| 4.8 Rescheduling | Designed in [rescheduling.md](rescheduling.md). Staff move a booking to another time or ground, or swap two, in one transaction: the old booking ends `RESCHEDULED`, the new one keeps the original's terms at the new slots' prices, and a `Rescheduling` records it (refills use it too). Listings follow the booking. Picking a free target slot holds it automatically until the move is confirmed, and the move releases the hold in the same transaction. Staff holds: a staff `HELD` booking that expires after `staffHoldMinutes`, with confirm, extend and release |
| 4.7 Listings | Designed in [listings.md](listings.md). A `BookingListing` per listed app booking, with `neededPlayers` capped by the ground's size and only lowered down to the joined count. `ListingPlayer` for joining, leaving and removal under a lock on the listing. The "games needing players" feed and share link, the disclaimer, phone numbers shared after joining, informational cost share, and no-show reports with a reliability figure |

**Screens:** customer app: the layout-first booking flow, my bookings, listings (feed, join, leave). Dashboard: the calendar, approvals, walk-in and phone bookings, regulars and their weekly reservations, Fill a slot, move, swap and hold. Web: the shared booking page (`/b/[code]`).
**Admin slice:** look up any booking and its events.
**Done when:** the 100-request race leaves exactly one booking, and a customer books and staff manage it end to end in the apps.

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
| 6.3 Ledger and commission | `LedgerEntry` for collections, refunds, commission, payouts and adjustments. Commission on what the venue keeps, recorded once at the final state. Cash commission makes the balance negative |
| 6.4 Payouts | Payout destinations (bank, wallet, InstaPay; one active per venue). Payout runs, statuses, the VAT invoice for Hagz's commission |
| 6.5 Nightly audit | The ledger reconciled against payments, refunds and payouts. Any drift alerts |

**Screens:** customer app: cancelling with the policy summary and refund amount. Dashboard: cancellations, refunds, the ledger and earnings, payout destinations and payouts. Admin web: payout runs and adjustments.
**Admin slice:** payouts, ledger adjustments, cancelling with any refund.
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

**Screens:** both apps: the notification inbox and push permission. Customer app: loyalty cards, reviews, discount codes at checkout, the waitlist, offer and nearby-game opt-ins. Dashboard: loyalty and discount settings, fill-a-slot alerts. Web: the regular's confirm or release page (reminder link).
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

## Phase 9: Launch readiness (backend)

- The pre-launch list for the code routes: Cloudflare in front with the origin locked, `CLIENT_IP_HEADER`, alerting on the global code cap, device attestation (Play Integrity, App Attest), a Meta spending alert.
- Observability: Sentry, OpenTelemetry traces, metrics and SLO dashboards.
- Load tests with k6, a security review, a restore drill, runbooks.
- Production on a paid plan, with the API and database in one region.
- Legal: terms reflecting the agent model, holding venues' money (payment licensing), ETA e-receipts.

## Phase 10: Store launch

The apps have been built phase by phase, so this phase only finishes them:

- Polish: empty states, loading and error states, accessibility, Arabic right-to-left review, app icons and splash screens.
- Store listings and submissions for both apps (privacy labels, account deletion, push permission text).
- The production cut-over, and the Egypt marketplace switched on.
