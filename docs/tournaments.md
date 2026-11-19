# Tournaments

Teams register, fixtures are drawn, and results build a bracket or a table. Built in Phase 4b of [plan.md](plan.md). Agreed on 2026-11-19.

**Kept deliberately minimal** (the user, 2026-11-19): venue tournaments are still an unknown feature, so the schema holds only what every tournament needs. Anything we're unsure of is either a rule kept in JSON (no migration to change it) or left out until real use asks for it.

## Who organizes

| | Venue tournament | Community tournament |
|---|---|---|
| Organized by | Venue staff, in the staff app | The community's owner and admins |
| Who sees it | Everyone: the Community tab's Tournaments feed and the venue's page | Members only. Never listed publicly |
| Who can register a team | Whoever the tournament's join rules allow | Members only (always), plus the join rules |

## Join rules

Who can join is **flexible, set by the organizer for each tournament** (the user, 2026-11-19). The rules are one JSON value, `joinRules`, defined by a Zod schema in `@hagz/contracts` and checked by the API when a team registers and when a player joins a squad. A new kind of rule is a code change, never a migration.

The first rules:

| Rule | Meaning | Default |
|---|---|---|
| `approval` | `AUTO` (first come, first confirmed) or `ORGANIZER` (each team approved) | `ORGANIZER` |
| `squadMin`, `squadMax` | Players per team | The ground size's player count, both |
| `minReliability` | The lowest "showed up" percentage a player can have, from open games | None |
| `maxTeamsPerPlayer` | 1 means a player can be in only one squad per tournament | 1 |

- **The organizer can change the rules freely until the first team registers.** After that they can only loosen them, never tighten. A team that was allowed in can't be pushed out by a rule change.
- **The rules are shown on the tournament page in plain language,** generated from the JSON, like cancellation policies.
- Rules that need data we don't have (an age limit needs a date of birth) wait until that data exists.

## Formats

Two to start: **knockout** (single elimination, byes when the number of teams isn't a power of two, penalties settle draws) and **league** (everyone plays everyone once; win 3, draw 1, loss 0; ties broken by goal difference, then goals scored). Groups then knockout comes later if organizers ask for it.

## Lifecycle

`DRAFT` → `OPEN` (registration) → `RUNNING` → `COMPLETED`, or `CANCELLED` from any state before `COMPLETED`.

- **`DRAFT`:** only the organizers see it.
- **`OPEN`:** captains register teams until `registrationClosesAt` or the team limit.
- **`RUNNING`:** the organizer closes registration and draws the fixtures, at random. Results are entered as matches are played.
- **`COMPLETED`:** the final result is in, and the bracket or table stays visible.

## Teams

- **A captain registers a team** with a name and invites players by link. Every player needs a Hagz account.
- **Team status** is `PENDING` until confirmed (automatically, or by the organizer, depending on `approval`), then `CONFIRMED`. A team can be `WITHDRAWN` by its captain or `REJECTED` by the organizer.
- **There's no waitlist.** When the tournament is full, registration closes. A waitlist can come later.

## Matches

- **A match records which ground and when, for display only:** `groundId?` and `startsAt?`. The venue reserves the time with the staff blocking it already has, and a community member books the ground like any booking. **Nothing in the slot or booking tables changes for tournaments.** If organizers need the calendar to know about matches, that link comes later.
- **The organizer enters results:** a score, penalties for a knockout draw, or a walkover. A knockout winner fills its place in the next match (`nextMatchId`, `nextSide`) in the same transaction.
- **Tables are calculated from results when read,** not stored.

## Notifications

Sent once Phase 7's sender exists, and written as `Notification` rows until then.

- **Organizers:** a team registered, or withdrew.
- **Captains:** their team was confirmed or rejected, and the draw is out.
- **Squad players:** their next match's time and ground, and a reminder before it; the tournament being cancelled.

## Money

- **Entry fee:** `entryFee?`, shown on the tournament and paid to the organizer, outside Hagz. Whether Hagz handles or takes part of it is decided later.
- **Prizes:** text only. If prizes are paid out of entry fees, a lawyer must check that before Hagz takes any part of the fees.

## Schema

- **`Tournament`:** `id`, `code` (unique, for `/t/[code]`), `venueId?`, `communityId?`, `name`, `description?`, `sport`, `size`, `format` (`KNOCKOUT` / `LEAGUE`), `status`, `teamCap`, `joinRules` (JSON), `entryFee?`, `prizes?`, `registrationClosesAt`, `startsOn`, `createdById` (a staff id or a customer id, according to the organizer), `createdAt`, `updatedAt`.
  - CHECKs: exactly one of `venueId` and `communityId`; `teamCap >= 2`; `entryFee >= 0`.
  - Indexed on `(status, startsOn)`, `venueId` and `communityId`.
- **`TournamentTeam`:** `id`, `tournamentId`, `name`, `captainId`, `status`, `createdAt`. Unique on `(tournamentId, name)`.
- **`TournamentPlayer`:** `teamId`, `customerId`, `tournamentId` (copied, for the one-squad rule), `joinedAt`. Its primary key is `(teamId, customerId)`. Leaving deletes the row: there's no history to keep until a tournament starts, and after that squads are frozen.
- **`TournamentMatch`:** `id`, `tournamentId`, `round`, `position`, `homeTeamId?`, `awayTeamId?`, `nextMatchId?`, `nextSide?`, `groundId?`, `startsAt?`, `status` (`PENDING` / `PLAYED` / `WALKOVER`), `homeScore?`, `awayScore?`, `homePenalties?`, `awayPenalties?`, `winnerTeamId?`. Unique on `(tournamentId, round, position)`. CHECKs: the two teams differ, and scores are set exactly when `PLAYED`.

Registering and confirming teams lock the `Tournament` row, so `teamCap` holds. Joining a squad locks the team row, so `squadMax` holds. There's no tournament event table. Changes are recorded in the organizer's existing history: `VenueEvent` for a venue tournament, `CommunityEvent` for a community tournament.

## Left out until real use asks for it

Groups then knockout, seeding, waitlists, squad changes after the start, a link from matches to slots or bookings, online entry fees, player statistics, and the staff permission area (tournaments use the venue's Bookings permission for now).
