# Onboarding

How a venue goes from a staff member's first tap to bookable, and how it changes after that. It covers PRs 2.2 (venue creation) and 2.7 (go-live review) in [plan.md](plan.md), and the parts of 2.3–2.6 that feed the setup checklist.

## Decisions

Agreed on 2026-10-27:

- **Create, then a checklist.** The first step creates a `DRAFT` with the basics. The setup checklist can then be done in any order, and every item is saved as real data, never as wizard state. Submitting unlocks when every required item is done.
- **Languages:** the owner writes the name, description and address in their app language only; the app shows no language switch (decided 2026-11-13). Admins fill in the other language while provisioning. Going live requires Arabic and English.
- **Slug:** a random id generated at creation and never changed, e.g. `/venue/k7m2x9pq` (see [Slugs and SEO](#slugs-and-seo)).
- **Location:** the owner drops a pin or searches Google Places, the app suggests the area from the `Location` tree (matching Google's address to our location names), and the owner confirms or changes it. The API checks the pin against a rough bounding box per marketplace, enough to catch a pin in the wrong country (decided 2026-11-12).
- **Drafts live outside the venue dashboard.** An unfinished venue opens its own setup flow, reached from first run (no venues yet) or from the Venues section of the Account tab; the dashboard's tabs and switcher are for `LIVE` and `MAINTENANCE` venues (decided 2026-11-12).
- **Staff join after approval.** Invitations can only be sent once an admin has approved the venue (`PROVISIONING`, `LIVE` or `MAINTENANCE`); before that the API answers `409 VENUE_STATUS_CONFLICT` (decided 2026-11-13). A draft or a venue in review has nothing for staff to do, and rejection only happens before approval, so an approved venue never loses the ability.
- **One unfinished venue per staff account.** A venue they own in `DRAFT`, `SUBMITTED` or `PROVISIONING` blocks starting another until it goes live (clarified 2026-11-12). Any number of live venues, so chains are fine.
- **Nothing is deleted.** Drafts stay until submitted, and a rejected venue goes back to `DRAFT` with the reason.
- **Ownership changes only through support.** An admin transfers it to an existing member after checking identity, because ownership controls payouts.
- **After going live, nothing is reviewed again.** Members with the right permission edit anything, including the name and location, and it applies at once. Every edit is a `VenueEvent` with the previous and new values, so admins can audit and revert from the admin panel.

## Lifecycle

| Status | Who moves it here | What the owner can do | Visible to customers |
|---|---|---|---|
| `DRAFT` | The owner creates it, or an admin rejects it | Edit everything, then submit | No |
| `SUBMITTED` | The owner submits | Withdraw it (back to `DRAFT`). Edit grounds, schedules and settings. Listing details are locked while it's reviewed | No |
| `PROVISIONING` | An admin approves | Edit grounds, schedules, settings and staff, and invite staff. Listing identity stays locked | No |
| `LIVE` | An admin, once provisioning is complete | Everything, applied at once (see [Edits after going live](#edits-after-going-live)) | Yes: page, search, sitemap, bookings |
| `MAINTENANCE` | The owner (`venue: manage`) or an admin | Everything, then switch back to `LIVE` | Page visible with a notice. No new bookings; existing bookings stand |

Each transition is a `VenueEvent` (`VENUE_CREATED`, `VENUE_SUBMITTED`, `VENUE_WITHDRAWN`, `VENUE_REJECTED` with the reason, `VENUE_APPROVED`, `VENUE_LIVE`, `VENUE_PAUSED`, `VENUE_RESUMED`). The owner gets a notification on approval, rejection and going live; admins get one on each submission. The current rejection reason is the latest `VENUE_REJECTED` event, so `Venue` needs no extra column.

## Step 1: creating the draft

`POST /v1/staff/venues` (`requireStaff`), with:
- `name` (2–60 characters), stored in the caller's app language (`Staff.language`);
- `coordinates` (`latitude`, `longitude`) and an optional Google `placeId`;
- the confirmed `locationId` from the `Location` tree.

In one transaction, the server:
1. Locks the staff row and checks they own **no other unfinished venue** (`DRAFT`, `SUBMITTED` or `PROVISIONING`). If they do, `409 UNFINISHED_VENUE_EXISTS`, with that venue's `venueId` and `venueStatus` so the app can open it. Venues they only work at don't count.
2. Checks the location exists and belongs to an **active marketplace** (else `422 LOCATION_NOT_FOUND`), and the pin falls inside the marketplace's bounding box (else `422 LOCATION_OUTSIDE_MARKETPLACE`; a marketplace without a box isn't checked). The marketplace comes from the location, so the owner never picks one.
3. Creates the `Venue` with its **permanent random slug**, a `VenueTranslation` with the name only, and `VenueSettings` with the platform defaults: no cancellation policy yet, and invitations offering front-desk permissions (`bookings`, `customers` and `payments` on `manage`; `schedule` and `venue` on `view`; `finance` and `staff` on `none`). The slug isn't public until the venue is live.
4. Creates the `OWNER` membership and the `VENUE_CREATED` event.

The response is the venue with its checklist, the same as the setup endpoint below.

## Step 2: the setup checklist

`GET /v1/staff/venues/{venueId}/setup` (`venue: view`) returns the venue (id, slug, status, name), every item with its `key`, whether it's `required`, its `state` (`DONE`, `MISSING`, or `BLOCKED` with the item it waits on in `blockedBy`), the count of required items done (`required.done` / `required.total`, for the progress ring and the draft card) and `canSubmit`.

| Item | Required to submit | Edited through | Area |
|---|---|---|---|
| Details | Name, description and address in at least one language. A phone number | `PATCH /venues/{id}`, `PUT /venues/{id}/translations/{language}` | `venue` |
| Location | The pin and the area (set at creation; editable) | `PATCH /venues/{id}` | `venue` |
| Photos | At least 3 `READY` images (PR 2.3) | Media endpoints | `venue` |
| Amenities | Optional | `PUT /venues/{id}/amenities` | `venue` |
| Grounds | At least one active ground with prices (PR 2.4) | Ground endpoints | `schedule` |
| Schedules | Every active ground has opening hours (PR 2.4) | Schedule endpoints | `schedule` |
| Layout | Only for venues with more than one ground (PR 2.5) | Layout endpoints | `venue` |
| Settings | A cancellation policy chosen by the owner (payment mode and notice have working defaults) | `PUT /venues/{id}/settings` | `venue` |
| Tax number | Optional; if set, an admin checks it while provisioning | `PATCH /venues/{id}` | `venue` |

The checklist is computed from the data on every request. Nothing stores "step 3 done", so the checklist can never disagree with the venue. Items whose PR hasn't been built yet don't appear. When payouts arrive (Phase 6), online payment modes also require a payout destination before going live.

**Submitting:** `POST /v1/staff/venues/{venueId}/submit`, **owner only**. It runs the same checks the checklist shows and answers `422 SETUP_INCOMPLETE` listing what's missing. **Withdrawing:** `POST .../withdraw`, owner only, `SUBMITTED` → `DRAFT`.

## Step 3: admin review and provisioning

The admin side (`/v1/admin/venues`):

- **Queue:** venues by status, oldest submission first, with the owner and the submission history.
- **Reject** (`SUBMITTED` → `DRAFT`) with a reason the owner sees. It stays the owner's one unfinished venue, so rejecting (like withdrawing) needs no check.
- **Approve** (`SUBMITTED` → `PROVISIONING`).
- **Provision**, while in `PROVISIONING`:
  - complete the translations so Arabic and English both exist;
  - check the tax number;
  - set a commission override if agreed;
  - adjust photos if needed.
- **Go live** (`PROVISIONING` → `LIVE`) once both languages exist, the venue has at least one `ACTIVE` ground (see [A live venue always has a ground](#a-live-venue-always-has-a-ground)), and slot generation has run for every ground (`generatedUntil` is set).
- **Pause and resume** any live venue. Resuming (`MAINTENANCE` → `LIVE`, by the owner or an admin) needs an `ACTIVE` ground too, or it answers `409 NO_ACTIVE_GROUND`.
- **Transfer ownership** to an existing member. In one transaction, the old owner becomes a `MEMBER` with full permissions, and both people are notified. Transferring an unfinished venue locks the new owner's staff row and is refused with `409 UNFINISHED_VENUE_EXISTS` if they already own one.

## Edits after going live

- **Every edit applies at once** for members with the permission for that area (`venue` for details, location, photos, amenities, layout and settings; `schedule` for grounds, prices and schedules). Name and location included; nothing waits for an admin.
- **Every edit is a `VenueEvent` with the previous and new values** of what changed (`VENUE_DETAILS_CHANGED`, `VENUE_LOCATION_CHANGED`, `VENUE_SETTINGS_CHANGED`, and so on). Admins see a venue's history in the admin panel and can **revert** a change, which applies the previous values and writes its own event.
- **A live venue keeps an active ground.** See below.
- **The area can't move to another marketplace.** A live venue's currency, VAT, amenities and payouts belong to its marketplace, so a new location must be in the same one. The pin must still fall inside it.

### A live venue always has a ground

A `LIVE` venue always has at least one `ACTIVE` ground; a venue with nothing to book shouldn't be in search. Grounds under `MAINTENANCE` don't count, and neither do `DELETED` ones (agreed 2026-11-11).

- **Going live and resuming** check it, as above.
- **Deleting a ground, or putting it under maintenance,** when it's the live venue's last `ACTIVE` one is refused with `409 LAST_ACTIVE_GROUND`: add another ground first, or pause the venue. The venue is never paused behind the owner's back.
- **Concurrency:** every ground status change locks the venue row (`FOR UPDATE`) before counting, so two members pausing the last two grounds at once can't each see the other as still active.
- A venue in `DRAFT`, `SUBMITTED`, `PROVISIONING` or `MAINTENANCE` can have no active grounds; the submit checklist asks for one separately.
- Enforced in the API (PRs 2.4 and 2.7), not the database: the rule spans two tables and changes with the venue's status.

## Slugs and SEO

- **Format:** 8 random characters, lowercase letters and digits without lookalikes (no `0`/`o`, `1`/`l`/`i`), e.g. `/venue/k7m2x9pq`. Generated at creation, retried on the rare clash with the unique index, stored in `Venue.slug`.
- **Stable:** it never changes, so shared links and search rankings survive renames with no redirects to maintain.
- **The trade-off:** the venue's name isn't in the URL, so ranking rests on the page itself. If that's ever worth changing, add a decorative name after the id (`/venue/k7m2x9pq/wadi-degla-maadi`): the id identifies the venue, and a wrong or old name redirects to the canonical URL.
- **What ranks** (built in Phase 3 and Phase 10):
  - server-rendered `/ar` and `/en` versions linked with `hreflang`;
  - schema.org `SportsActivityLocation` with `AggregateRating` structured data;
  - a canonical URL;
  - a sitemap of live venues.
- **Area pages** (`/eg/cairo/maadi`) listing live venues, built from the `Location` slugs. They target searches like "padel courts in Maadi" and are likely to bring more search traffic than venue names do.

## Schema changes

- **No new tables.** Lifecycle steps and edits are new `VenueEvent` types, listed above, and each edit event stores the previous and new values.
- **Draft-friendly columns** (PR 2.2): `VenueTranslation.description` and `address` are optional, since a draft starts with a name only; `VenueSettings.cancellationPolicy` is null until the owner chooses one (its CHECK uses `IS TRUE` so a missing policy can't carry custom tiers).
- **`Marketplace` bounding box:** four optional corners (`minimumLatitude`, `maximumLatitude`, `minimumLongitude`, `maximumLongitude`), all or none, checked by a CHECK. Egypt's is seeded.
- **No column for the one-unfinished-venue rule:** it's checked under a lock on the staff row when a venue is created or transferred, the only two ways someone gains one.

## Errors

| Code | When |
|---|---|
| `409 UNFINISHED_VENUE_EXISTS` | Creating a venue, or receiving an unfinished one by transfer, while already owning one in `DRAFT`, `SUBMITTED` or `PROVISIONING` (includes `venueId` and `venueStatus`) |
| `422 SETUP_INCOMPLETE` | Submitting with checklist items missing (lists them) |
| `409 VENUE_STATUS_CONFLICT` | An action not allowed in the current status, e.g. inviting staff before approval, or editing listing details while `SUBMITTED` (includes `venueStatus`) |
| `422 LOCATION_NOT_FOUND` | Creating a venue in an area that doesn't exist, or whose marketplace isn't active |
| `422 LOCATION_OUTSIDE_MARKETPLACE` | The pin isn't inside the marketplace of the chosen area, or a new area is in another marketplace |

## Open

- How many photos submission requires (3 above is a placeholder).

Decided 2026-11-12: the venue phone is only checked as a valid number (it's shown to players, not used to sign in), and the owner must choose a cancellation policy consciously (no default counts as done).
