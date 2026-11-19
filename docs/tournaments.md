# Tournaments

Teams register, fixtures are drawn, matches are played on real grounds, and results build a bracket or a table. Built in Phase 4b of [plan.md](plan.md). Agreed on 2026-11-19.

## Who organizes

| | Venue tournament | Community tournament |
|---|---|---|
| Organized by | Venue staff, in the staff app | The community's owner and admins |
| Who sees it | Everyone: the Community tab's Tournaments feed and the venue's page | Members only. Never listed publicly |
| Who can register a team | Any signed-in customer (rules still to decide, see [Open](#open)) | Members only, and every player must be a member |
| Ground time | The venue blocks its own grounds for each match | A member books each match's ground like any booking, then links it to the match |
| Venues | Its own | Any, match by match |

Venue tournaments are something venues already run on paper and WhatsApp. Doing it in the staff app is a reason for venues to use Hagz, and it brings teams of players into the customer app.

## Formats

- **Knockout:** single elimination. Byes when the number of teams isn't a power of two. Draws are settled by penalties.
- **League:** everyone plays everyone once. Win 3, draw 1, loss 0. Ties broken by goal difference, then goals scored, then head to head.
- **Groups then knockout:** groups play leagues, and the top N of each group go into a knockout.

Ramadan night tournaments are the obvious first use, and every format needs to work for them.

## Lifecycle

`DRAFT` → `REGISTRATION` → `SCHEDULED` → `RUNNING` → `COMPLETED`, with `CANCELLED` possible from any state before `COMPLETED`.

- **`DRAFT`:** the organizer sets the sport, size, format, team limit, squad sizes, dates, rules and prizes. Only organizers can see it.
- **`REGISTRATION`:** published. Captains register teams until `registrationClosesAt` or until it's full. After that, teams join a waitlist.
- **`SCHEDULED`:** registration has closed and the organizer has confirmed the teams. Fixtures are drawn: random, or seeded by the organizer. The organizer gives each match a ground and a time.
- **`RUNNING`:** from the first kick-off. The organizer enters results, and winners move on in the bracket.
- **`COMPLETED`:** the final result is in. The bracket or table stays visible.
- **`CANCELLED`:** every team is told. A venue tournament's blocked slots are released.

## Teams

- **A captain registers a team:** its name, which is unique within the tournament, and its squad. Players join through a team invite link. Every player needs a Hagz account.
- **One team per player per tournament.**
- **A team is `PENDING` until the organizer confirms it.** For venue tournaments, "first come, first confirmed" is an organizer setting. Confirmation needs the squad to be at least `squadMin`.
- **Squad changes** are allowed until the tournament starts, up to `squadMax`. After that, only the organizer can change a squad.
- **Withdrawing** before the draw frees the place, and the next team on the waitlist is offered it. Withdrawing after the draw gives each remaining opponent a walkover.

## Matches and results

- **Ground time is real slot state,** so the calendar, search and double-booking protection keep working without changes:
  - In a venue tournament, the match's slots are `BLOCKED` and carry the match's id (`GroundSlot.matchId`, like `bookingId`). Staff see "Tournament: Team A vs Team B" on the calendar. No commission is taken: the venue is using its own grounds.
  - In a community tournament, the match points to a normal `Booking` that a member made and paid for. The booking keeps all its usual rules, including commission.
- **Results** are entered by the organizer: the score, penalties for a knockout draw, or a walkover. A knockout winner fills its place in the next match (`nextMatchId` and `nextSide`) in the same transaction. A corrected result is allowed only while the next match hasn't been played.
- **Tables and standings** are calculated from results when read, not stored. A tournament has a few dozen matches at most.
- **Disputes** go to the organizer, whose result stands. Every change is a `TournamentEvent`.

## Money

- **Entry fee:** optional, per team, shown on the tournament. How it's paid is still open (see below). Until that's decided, it's paid to the venue in cash, and Hagz takes nothing from it.
- **Prizes:** text only ("5,000 EGP and a trophy"). If prizes are paid out of entry fees, a lawyer must confirm that this isn't treated as gambling before Hagz takes any part of the fees.

## Schema

- **`Tournament`:** `id`, `code` (unique, for the share link `/t/[code]`), `venueId?`, `communityId?`, `name`, `description?`, `sport`, `size`, `format` (`TournamentFormat`: `KNOCKOUT` / `LEAGUE` / `GROUPS_KNOCKOUT`), `status` (`TournamentStatus`), `teamCap`, `squadMin`, `squadMax`, `groupCount?`, `advancePerGroup?`, `autoConfirm`, `entryFee?` (minor units), `prizes?`, `rules?`, `registrationClosesAt`, `startsOn`, `endsOn` (dates in the venue's or the community area's timezone), `staffCreatorId?`, `customerCreatorId?`, `createdAt`, `updatedAt`.
  - CHECKs: exactly one of `venueId` and `communityId`; the creator matches (staff for a venue, a customer for a community); `squadMin` between 1 and `squadMax`; `groupCount` and `advancePerGroup` set exactly for `GROUPS_KNOCKOUT`; `endsOn >= startsOn`.
  - Indexed on `(status, startsOn)` for the feed, plus `venueId` and `communityId`.
- **`TournamentTeam`:** `id`, `tournamentId`, `name`, `captainId`, `status` (`PENDING` / `CONFIRMED` / `WAITLISTED` / `WITHDRAWN` / `REJECTED`), `seed?`, `groupKey?`, `registeredAt`. Unique on `(tournamentId, name)`.
- **`TournamentPlayer`:** `teamId`, `customerId`, `tournamentId` (copied, so it can be unique on `(tournamentId, customerId)`: one team per player), `status` (`JOINED` / `LEFT` / `REMOVED`), `joinedAt`. Its primary key is `(teamId, customerId)`.
- **`TournamentMatch`:** `id`, `tournamentId`, `stage` (`GROUP` / `LEAGUE` / `KNOCKOUT`), `round`, `position`, `groupKey?`, `homeTeamId?`, `awayTeamId?` (empty until the bracket fills them), `nextMatchId?`, `nextSide?` (`HOME` / `AWAY`), `groundId?`, `startsAt?`, `endsAt?`, `bookingId?`, `status` (`PENDING` / `SCHEDULED` / `PLAYED` / `WALKOVER` / `CANCELLED`), `homeScore?`, `awayScore?`, `homePenalties?`, `awayPenalties?`, `winnerTeamId?`.
  - CHECKs: the two teams differ; scores set exactly when `PLAYED`; penalties only for a knockout draw; `bookingId` only in a community tournament.
  - Unique on `(tournamentId, stage, round, position)`.
- **`GroundSlot.matchId?`:** venue tournament slots, `BLOCKED`. CHECK: at most one of `bookingId` and `matchId`.
- **`TournamentEvent`:** append-only, like `BookingEvent`.

Registering, confirming and withdrawing teams lock the `Tournament` row, so the team limit holds. Joining a squad locks the team row, so `squadMax` holds.

## Open

Rules for venue tournaments open to everyone (the user is still deciding):

- Who can register: anyone, a minimum reliability, or an age limit.
- Whether every team needs organizer approval, or first come, first confirmed.
- Whether a player can be in squads for two tournaments that overlap in time.
- What happens when a team doesn't turn up: a walkover only, or a block from that venue's future tournaments.
- How the entry fee is paid (cash at the venue, or online once payments exist), whether Hagz takes commission on it, and refunds when a team withdraws or the tournament is cancelled.

Also open:

- The staff permission area for tournaments: a new eighth area, or part of an existing one.
- Player statistics (goals, cards) per match. Left out of v1.
