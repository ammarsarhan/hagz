# Onboarding

How a venue goes from a staff member's first tap to bookable, and how it changes after that. It covers PRs 2.2 (venue creation) and 2.7 (go-live review) in [plan.md](plan.md), and the parts of 2.3–2.6 that feed the setup checklist.

## Decisions

Agreed on 2026-10-27:

- **Create, then a checklist.** The first step creates a `DRAFT` with the basics. The setup checklist can then be done in any order, and every item is saved as real data, never as wizard state. Submitting unlocks when every required item is done.
- **Languages:** the owner writes the name, description and address in one language or both. Admins fill in the missing language while provisioning. Going live requires Arabic and English.
- **Slug:** a random id generated at creation and never changed, e.g. `/venue/k7m2x9pq` (see [Slugs and SEO](#slugs-and-seo)).
- **Location:** the owner drops a pin or searches Google Places, the app suggests the area from the `Location` tree, and the owner confirms or changes it.
- **One open draft per staff account.** Any number of venues past that, so chains are fine.
- **Nothing is deleted.** Drafts stay until submitted, and a rejected venue goes back to `DRAFT` with the reason.
- **Ownership changes only through support.** An admin transfers it to an existing member after checking identity, because ownership controls payouts.
- **After going live, nothing is reviewed again.** Members with the right permission edit anything, including the name and location, and it applies at once. Every edit is a `VenueEvent` with the previous and new values, so admins can audit and revert from the admin panel.

## Lifecycle

| Status | Who moves it here | What the owner can do | Visible to customers |
|---|---|---|---|
| `DRAFT` | The owner creates it, or an admin rejects it | Edit everything, then submit | No |
| `SUBMITTED` | The owner submits | Withdraw it (back to `DRAFT`). Set up staff and invitations. Listing details are locked while it's reviewed | No |
| `PROVISIONING` | An admin approves | Edit grounds, schedules, settings and staff. Listing identity stays locked | No |
| `LIVE` | An admin, once provisioning is complete | Everything, applied at once (see [Edits after going live](#edits-after-going-live)) | Yes: page, search, sitemap, bookings |
| `MAINTENANCE` | The owner (`venue: manage`) or an admin | Everything, then switch back to `LIVE` | Page visible with a notice. No new bookings; existing bookings stand |

Each transition is a `VenueEvent` (`VENUE_CREATED`, `VENUE_SUBMITTED`, `VENUE_WITHDRAWN`, `VENUE_REJECTED` with the reason, `VENUE_APPROVED`, `VENUE_LIVE`, `VENUE_PAUSED`, `VENUE_RESUMED`). The owner gets a notification on approval, rejection and going live; admins get one on each submission. The current rejection reason is the latest `VENUE_REJECTED` event, so `Venue` needs no extra column.

## Step 1: creating the draft

`POST /v1/staff/venues` (`requireStaff`), with:
- the name in one language (`AR` or `EN`);
- the pin: coordinates and an optional Google `placeId`;
- the confirmed `locationId` from the `Location` tree.

In one transaction, the server:
1. Locks the staff row and checks they have **no other venue in `DRAFT`** where they're the owner. If they do, `409 DRAFT_EXISTS`, with that venue's id so the app can open it.
2. Checks the location belongs to an **active marketplace**, and the pin falls inside it. The marketplace comes from the location, so the owner never picks one.
3. Creates the `Venue` with its **permanent random slug**, its `VenueTranslation`, and `VenueSettings` with the platform defaults (including the default staff permissions for invitations). The slug isn't public until the venue is live.
4. Creates the `OWNER` membership and the `VENUE_CREATED` event.

The response is the venue with its checklist, the same as the setup endpoint below.

## Step 2: the setup checklist

`GET /v1/staff/venues/{venueId}/setup` returns every item with its state (`done`, `missing`, or `blocked` with a reason), and whether the venue can be submitted.

| Item | Required to submit | Edited through | Area |
|---|---|---|---|
| Details | Name, description and address in at least one language. A phone number | `PATCH /venues/{id}`, `PUT /venues/{id}/translations/{language}` | `venue` |
| Location | The pin and the area (set at creation; editable) | `PATCH /venues/{id}` | `venue` |
| Photos | At least 3 `READY` images (PR 2.3) | Media endpoints | `venue` |
| Amenities | Optional | `PUT /venues/{id}/amenities` | `venue` |
| Grounds | At least one active ground with prices (PR 2.4) | Ground endpoints | `schedule` |
| Schedules | Every active ground has opening hours (PR 2.4) | Schedule endpoints | `schedule` |
| Layout | Only for venues with more than one ground (PR 2.5) | Layout endpoints | `venue` |
| Settings | Payment mode, cancellation policy and notice (defaults count as done) | `PUT /venues/{id}/settings` | `venue` |
| Tax number | Optional; if set, an admin checks it while provisioning | `PATCH /venues/{id}` | `venue` |

The checklist is computed from the data on every request. Nothing stores "step 3 done", so the checklist can never disagree with the venue. Items whose PR hasn't been built yet don't appear. When payouts arrive (Phase 6), online payment modes also require a payout destination before going live.

**Submitting:** `POST /v1/staff/venues/{venueId}/submit`, **owner only**. It runs the same checks the checklist shows and answers `422 SETUP_INCOMPLETE` listing what's missing. **Withdrawing:** `POST .../withdraw`, owner only, `SUBMITTED` → `DRAFT`.

## Step 3: admin review and provisioning

The admin side (`/v1/admin/venues`):

- **Queue:** venues by status, oldest submission first, with the owner and the submission history.
- **Reject** (`SUBMITTED` → `DRAFT`) with a reason the owner sees. The draft then counts as the owner's one open draft again.
- **Approve** (`SUBMITTED` → `PROVISIONING`).
- **Provision**, while in `PROVISIONING`:
  - complete the translations so Arabic and English both exist;
  - check the tax number;
  - set a commission override if agreed;
  - adjust photos if needed.
- **Go live** (`PROVISIONING` → `LIVE`) once both languages exist and slot generation has run for every ground (`generatedUntil` is set).
- **Pause and resume** any live venue.
- **Transfer ownership** to an existing member. In one transaction, the old owner becomes a `MEMBER` with full permissions, and both people are notified.

## Edits after going live

- **Every edit applies at once** for members with the permission for that area (`venue` for details, location, photos, amenities, layout and settings; `schedule` for grounds, prices and schedules). Name and location included; nothing waits for an admin.
- **Every edit is a `VenueEvent` with the previous and new values** of what changed (`VENUE_DETAILS_CHANGED`, `VENUE_LOCATION_CHANGED`, `VENUE_SETTINGS_CHANGED`, and so on). Admins see a venue's history in the admin panel and can **revert** a change, which applies the previous values and writes its own event.
- **The area can't move to another marketplace.** A live venue's currency, VAT, amenities and payouts belong to its marketplace, so a new location must be in the same one. The pin must still fall inside it.

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
- **No column for the one-draft rule:** it's checked in the creation transaction under a lock on the staff row.

## Errors

| Code | When |
|---|---|
| `409 DRAFT_EXISTS` | Creating a venue while already owning one in `DRAFT` (includes its id) |
| `422 SETUP_INCOMPLETE` | Submitting with checklist items missing (lists them) |
| `409 VENUE_STATUS_CONFLICT` | An action not allowed in the current status, e.g. editing listing details while `SUBMITTED` |
| `422 LOCATION_OUTSIDE_MARKETPLACE` | The pin isn't inside the marketplace of the chosen area, or a new area is in another marketplace |

## Open

- How many photos submission requires (3 above is a placeholder).
- Whether the phone number must be verified by a code or is only checked as a valid number.
- Whether the default cancellation policy (`MODERATE`) should count as "done" or the owner must choose one consciously.
