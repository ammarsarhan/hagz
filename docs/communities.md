# Communities

A community is a group of players: a company team, a university group, a neighbourhood's Friday game. It plays together, lists games for its members first, and runs its own tournaments. It lives in the customer app's Community tab. Built in Phase 4b of [plan.md](plan.md). Agreed on 2026-11-19.

A community is only worth joining if it does something, so v1 is built around **games and tournaments**, not posts. There's no chat and no feed of posts. Groups that want chat add their WhatsApp group link.

## Open and closed

| | Open | Closed |
|---|---|---|
| Shows up in community search | Yes | Yes (name, avatar, sport, area, member count) |
| Joining | Instant | A request that an admin approves, or an invite link |
| Members, games, tournaments, notice, WhatsApp link | Anyone can see them | Members only |

An invite link joins without approval, for either kind. Admins create and revoke links. Each link can expire and can have a use limit, and a code is stored as an HMAC, like staff join codes.

## Roles

- **Owner:** exactly one per community, and the one who created it. Changes settings, appoints and removes admins, transfers ownership, archives the community. The owner can't leave without transferring ownership first or archiving.
- **Admin:** approves and declines requests, removes and bans members, manages invite links, edits the notice, lists community games, runs the community's tournaments. The owner can do all of this too.
- **Member:** plays in its games and tournaments, and can leave at any time.

## Rules

- **Who can create one:** any signed-in customer with a verified phone, owning at most 5 active communities.
- **Name and link:** the slug is unique across Hagz (`/c/[slug]`). Names aren't unique. One language: it's the players' own text, so there's no translation table.
- **Joining:** not when banned. A declined request can be sent again after 7 days. Leaving and rejoining reuses the member row.
- **Removal and bans:** a removed member can rejoin (or request again). A banned member can't, until an admin lifts the ban.
- **Privacy:** members see each other's first names, avatars and reliability. **Phone numbers are never shared through a community.** They're shared only through a game, under the [listings](listings.md) rules.
- **Archiving:** the owner archives the community. It disappears from search, its open games become public listings (or close, the owner's choice), and its unfinished tournaments are cancelled.
- **Moderation:** anyone can report a community. Admins (Hagz) can hide one (`HIDDEN`) with a reason, which removes it from search and blocks joining, and can unhide it.

## Community games

The owner or an admin lists their own booking as a community game (decided on 2026-11-19: members can't, so a community's games are always its organizers'). It's an ordinary [listing](listings.md) with a `communityId`, following the same rules and money: prepaid, share to the booker, 10% joining fee at the venue.

- **Members only** until `publicAt`, if the booker sets one (for example, "open to everyone 24 hours before kick-off if it isn't full"). From then on it's in the public feed as well. Without `publicAt` it stays members-only.
- It shows on the community's page and in members' Games feed, marked with the community's name.
- Leaving or being removed from the community doesn't remove the player from games they've already joined.

## What people see

| | Not a member | Member |
|---|---|---|
| Name, avatar, sport, area, member count, open or closed | Yes | Yes |
| Description | Yes | Yes |
| Members (first names, avatars, reliability) | Open communities only | Yes |
| Games and tournaments | Open communities only | Yes |
| Notice and WhatsApp link | No | Yes |

## Notifications

Sent once Phase 7's sender exists. Until then they're written as `Notification` rows, like every phase before it.

- **Admins:** a new join request.
- **The player:** their request was approved or declined, they were made an admin, they were removed or banned, ownership was transferred to them.
- **Members:** a new community game or tournament, and the community being archived. Each member can mute a community.

## Finding communities

From the Community tab: search by name (`pg_trgm`, the same Arabic and English normalization as venues), with area and sport filters. Ranked by name match, then distance from the community's area, then member count. Communities that have played recently rank above inactive ones.

## Schema

- **`Community`:** `id`, `slug` (unique), `name`, `description?`, `avatarKey?`, `sport?` (`Sport`), `locationId` (its home area), `policy` (`CommunityPolicy`: `OPEN` / `CLOSED`), `notice?`, `whatsappLink?`, `status` (`CommunityStatus`: `ACTIVE` / `ARCHIVED` / `HIDDEN`), `memberCount` (kept up to date under a lock on this row, like `playerCount`), `hiddenReason?`, `createdAt`, `updatedAt`.
  - CHECKs: `memberCount >= 0`; `hiddenReason` set exactly when `HIDDEN`; `whatsappLink` is a `https://chat.whatsapp.com/` invite.
  - Indexed on `(status, locationId)`. The trigram index on the normalized name comes with 4b.1's search, using 3.1's name normalization.
- **`CommunityMember`:** `communityId`, `customerId`, `role` (`CommunityRole`: `OWNER` / `ADMIN` / `MEMBER`), `status` (`CommunityMemberStatus`: `REQUESTED` / `ACTIVE` / `DECLINED` / `LEFT` / `REMOVED` / `BANNED`), `muted` (default false), `requestedAt?`, `joinedAt?`, `leftAt?`, and `decidedAt?` with `deciderId?` (the community admin who last approved, declined, removed or banned them).
  - Primary key `(communityId, customerId)`, so rejoining reuses the row. Indexed on `customerId` for "my communities".
  - A partial unique index allows one `OWNER` per community, and a CHECK keeps the owner `ACTIVE`, so the owner can't leave without handing over first.
  - CHECKs: `requestedAt` set when `REQUESTED`, `joinedAt` when `ACTIVE`, `leftAt` exactly when `LEFT`; `DECLINED`, `REMOVED` and `BANNED` have a decider; `decidedAt` and `deciderId` both or neither.
- **`CommunityInvite`:** `id`, `communityId`, `codeHash` (unique), `createdById`, `expiresAt?`, `maxUses?`, `uses`, `revokedAt?`, `createdAt`. CHECK: `uses <= maxUses`.
- **`CommunityEvent`:** append-only, like `BookingEvent`, with at most one actor (`customerId` or `adminId`; none means the system): settings changed, member approved, removed, banned or promoted, ownership transferred, hidden or unhidden by an admin. Written in the same transaction as the change.
- **`BookingListing`** gains `communityId?` and `publicAt?`. CHECK: `publicAt` only with `communityId`. Indexed on `(communityId, status, startsAt)`.

Joining, approving, leaving and removing lock the `Community` row. That keeps `memberCount` exact, and no two concurrent changes can leave a community without its owner.

## Open

- Whether a closed community can also be hidden from search entirely (a "secret" group joined only by invite link).
- Limits: maximum members per community, and requests per player per day.
- Whether communities get their own reliability figure (the share of their games that went ahead), shown in search.
