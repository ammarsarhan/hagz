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
| `squadMin`, `squadMax` | Players per team | The sport's players per side, both (from the sport and size table in code: 5 for 5-a-side, 2 for padel) |
| `minReliability` | The lowest "showed up" percentage a player can have, from open games | None |

- **One squad per player per tournament is fixed,** not a rule: a unique index enforces it, because playing for two teams in the same tournament never makes sense.
- **The organizer can change the rules freely until the first team registers.** After that they can only loosen them, never tighten. A team that was allowed in can't be pushed out by a rule change.
- **The rules are shown on the tournament page in plain language,** generated from the JSON, like cancellation policies.
- Rules that need data we don't have (an age limit needs a date of birth) wait until that data exists.

## Formats

Two to start: **knockout** (single elimination, byes when the number of teams isn't a power of two, and every match needs a winner) and **league** (everyone plays everyone once). Groups then knockout comes later if organizers ask for it.

## Sports

Tournaments work for every sport we have (football, padel, tennis, basketball, volleyball). The tables hold nothing sport-specific (decided on 2026-11-19); what differs is a table per sport in code:

| Sport | Main result (`homeScore`, `awayScore`) | `scoreDetail` | Draws | League points, then tie-breaks |
|---|---|---|---|---|
| Football | Goals | `{ "penalties": [4, 3] }` after a knockout draw | League only | Win 3, draw 1; goal difference, goals scored |
| Padel, tennis | Sets won | Set scores, `[[6, 4], [3, 6], [10, 8]]` | Never | Win 2, loss 0; set difference, game difference |
| Volleyball | Sets won | Set scores, `[[25, 21], [23, 25], [15, 12]]` | Never | 3–0 or 3–1 win 3, 3–2 win 2, 2–3 loss 1; set ratio, point ratio |
| Basketball | Points | None (overtime is in the points) | Never | Win 2, loss 1; point difference |

- League points follow each sport's usual federation rules (FIVB for volleyball, FIBA for basketball). Padel and tennis have no standard league table, so theirs is a proposal. All of it lives in code and can change without a migration.
- `scoreDetail` is checked by a Zod schema per sport in `@hagz/contracts`, and must agree with the main result (the sets in the detail add up to the sets won).
- The API refuses a draw where the sport has none, and a knockout always needs a winner. The database only holds what's true in every sport: the higher main result wins.

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
- **The organizer enters results:** the main result with its detail (set scores, or penalties after a football knockout draw), or a walkover. A knockout winner fills its place in the next match (`nextMatchId`, `nextSide`) in the same transaction.
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

- **`Tournament`:** `id`, `code` (unique, for `/t/[code]`), `venueId?`, `communityId?`, `name`, `description?`, `sport`, `size`, `format` (`KNOCKOUT` / `LEAGUE`), `status`, `teamCap`, `joinRules` (JSON), `entryFee?`, `prizes?`, `registrationClosesAt`, `startsOn`, `staffCreatorId?` (a venue tournament) or `customerCreatorId?` (a community tournament), `createdAt`, `updatedAt`. Two creator columns, not one id that could point at either table, so each has a foreign key.
  - CHECKs: exactly one organizer, with a creator of its kind; `teamCap >= 2`; `entryFee >= 0`; `joinRules` is a JSON object.
  - Indexed on `(status, startsOn)`, `venueId` and `communityId`.
- **`TournamentTeam`:** `id`, `tournamentId`, `name`, `captainId`, `status`, `createdAt`, `updatedAt`. Unique on `(tournamentId, name)`, and on `(id, tournamentId)` as the target for players and matches, so neither can point at another tournament's team.
- **`TournamentPlayer`:** `teamId`, `customerId`, `tournamentId` (copied from the team, and the foreign key on `(teamId, tournamentId)` makes sure it matches), `joinedAt`. Its primary key is `(teamId, customerId)`; unique on `(tournamentId, customerId)` for one squad per player. Leaving deletes the row: there's no history to keep until a tournament starts, and after that squads are frozen.
- **`TournamentMatch`:** `id`, `tournamentId`, `round`, `position`, `homeTeamId?`, `awayTeamId?`, `nextMatchId?`, `nextSide?` (`MatchSide`: `HOME` / `AWAY`), `groundId?`, `startsAt?`, `status` (`PENDING` / `PLAYED` / `WALKOVER`), `homeScore?`, `awayScore?`, `scoreDetail?` (JSON), `winnerTeamId?`. Unique on `(tournamentId, round, position)`. Teams, the winner and the next match are foreign keys with the tournament's id, so a match can't reach outside its tournament.
  - CHECKs: round and position >= 1; the two teams differ; scores >= 0 and set exactly when `PLAYED`; `scoreDetail` only when `PLAYED`; `nextMatchId` and `nextSide` both or neither; the winner is one of the two teams, the side with the higher score whenever the scores differ, required for a `WALKOVER` and absent while `PENDING`.

Registering and confirming teams lock the `Tournament` row, so `teamCap` holds. Joining a squad locks the team row, so `squadMax` holds. There's no tournament event table. Changes are recorded in the organizer's existing history: `VenueEvent` for a venue tournament, `CommunityEvent` for a community tournament.

## Left out until real use asks for it

Groups then knockout, seeding, waitlists, squad changes after the start, a link from matches to slots or bookings, online entry fees, player statistics, and the staff permission area (tournaments use the venue's Bookings permission for now).
