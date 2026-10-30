# Flows

Every screen in the customer app, the dashboard app, the public web and the admin web, and how they connect. Agreed on 2026-10-30. The same map, laid out visually, is the FigJam board [Hagz — Flows](https://www.figma.com/board/MHlgVOnTh7VsJ9ujpW1auG). The visual references are on [Hagz — UI direction](https://www.figma.com/board/01tdfBef6r79PAwN4EkQ4J).

Flow ids (`C6`, `D11`, `A7b`) match the board. Each diagram uses the same colors as the board:

| Color | Meaning |
|---|---|
| White | Screen |
| Blue | Bottom sheet or modal |
| Yellow | Choice or state |
| Green | Result |
| Red | Destructive action, or a blocked or failed state |
| Violet | Tab or hub |

## Decisions

- **Language and theme:** screens are designed in English (LTR) first, then mirrored to Arabic. Light theme only in v1.
- **Customer tabs:** Explore · Search · Games · Bookings · Account. The inbox is behind a bell on Explore.
- **Explore** is a feed of rails: Nearby, Play again, Free tonight, Just freed, Instant confirmation, Top rated, Within budget, Most booked this week, New on Hagz, loyalty progress, and Games needing players. Each venue card shows a photo, rating, distance, perk pills (amenities, instant confirmation, loyalty, discounts) and free-time chips.
- **Booking is short steps,** each with a pinned total bar and Continue: ground and time (layout first) → extras (skipped when the venue has none) → players (optional) → review and pay.
- **Players asked at checkout:** the listing opens automatically once the booking is `CONFIRMED`. This changes the "who can list" rule in [listings.md](listings.md), to be updated with PR 4.7.
- **Guests sign in through a bottom sheet** and land back on the same step with their choices kept.
- **The web is view only:** public venue listings for search engines and exposure, shared links, and sending people to the apps. Nothing is booked on the web.
- **The dashboard is phone first,** with a tablet layout (one calendar column per ground). On a phone the calendar shows one ground at a time, with ground chips and an all-grounds strip.
- **Dashboard tabs:** Home · Calendar · Venue · Payments · Account. Long-pressing Venue opens the venue switcher; the dashboard shows one venue at a time. Customers and regulars, Team, Marketing and Setup all live under Venue.
- **Dashboard Home is Today.** While a venue isn't live, Home is its setup checklist. Moving a booking uses pick mode. A new booking starts from a slot.
- **Changing a regular's time or ground** releases its future `UNCONFIRMED` reservations and re-creates them at the new time; `CONFIRMED` ones stay. To be added to [regulars.md](regulars.md) with PR 4.5.
- **Negative balances** (commission on cash bookings) are settled by a wire or cash collected in person, then recorded by an admin as an `ADJUSTMENT` whose note gives the method and the reference.
- **The admin web** is English only, for desktop.
- **Every screen also gets empty, loading and error states** (Phase 10). They're designed per screen, not drawn here.

## Customer app

Expo, for players. Guests browse everything; signing in is asked for only on Continue, Join, Save or Bookings.

### C1 First run

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  splash["Splash"] --> lang["Language: English or Arabic"] --> loc["Location permission (can skip)"] --> explore["Explore (guest)"]:::hub
```

### C2 Sign-in sheet

Opens over the current step; choices are kept.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  trigger["Continue, Join or Save tapped as a guest"] --> phone["Phone number"]:::sheet --> code["WhatsApp code"]:::sheet
  code --> fresh["New: name + password"]:::sheet
  code --> existing["Existing: password"]:::sheet
  code --> forgot["Forgot password → code → new password"]:::sheet
  fresh --> back["Back on the same step, signed in"]:::result
  existing --> twofa["Two-factor code (if on)"]:::sheet --> back
  forgot --> back
  existing --> suspended["C2b Suspended: until when, contact support"]:::danger
  existing --> banned["C2b Banned: contact support"]:::danger
```

### C3 Explore

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  feed["Explore feed: sport chips, bell, rails"]:::hub --> card["Venue card: photo, rating, distance, perk pills, free-time chips"]
  card --> venue["Venue page (C5)"]
  card --> chip["Free-time chip → book at that time (C6)"]
  feed --> all["Rail #quot;See all#quot; → search results (C4)"]
  feed --> bell["Bell → inbox (C9)"]
```

### C4 Search

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  search["Search: where · when · sport"]:::hub --> filters["Filters"]:::sheet
  filters --> where["Where: area, near me + radius, or a name"]
  filters --> when["When: exact start + duration, a window + duration range, or any time on a date"]
  filters --> ground["Ground: sport, size, surface, indoor / outdoor / covered, number of grounds"]
  filters --> venueF["Venue: price range, amenities, minimum rating, instant confirmation, cash or online, flexible cancellation, loyalty, discounts"]
  filters --> sort["Sort: distance, price, rating, soonest, best match"]
  where & when & ground & venueF & sort --> results["Results: cards with free-time chips"]
  results <--> map["Map with price pins (toggle)"]
  search --> areas["Browse by area"] --> results
  results --> venue["Venue page (C5)"]
  map --> venue
```

### C5 Venue page

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  page["Venue page: photos, rating, perks, about, amenities, policy in plain words, reviews, map"] --> pick["Date strip, start time, duration"]:::sheet
  pick --> layout["Layout: free grounds lit, others greyed"]
  pick --> list["List view of grounds"]
  layout <--> list
  layout & list --> slots["Ground picked: its free slots"] --> book["Continue to C6"]
  page --> paused["C5b Venue paused: notice, booking switched off"]:::state
  layout --> groundOff["C5b Ground in maintenance: greyed out"]:::state
```

### C6 Book

Short steps, each with a pinned total bar and Continue.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  s1["1 Ground and time (from C5)"] --> signin["Sign-in sheet if guest (C2)"]:::sheet --> s2["2 Extras: priced amenities (skipped if none)"]
  s2 --> s3["3 Players (optional): needed, note, cost share"]
  s3 --> s4["4 Review and pay: breakdown, VAT, policy, discount code, loyalty reward, payment method"]
  s4 --> pay["Pay: card, wallet, Apple Pay, Google Pay (Paymob fields), Fawry code, or at the venue"]:::sheet
  pay --> confirmed["Confirmed"]:::result
  pay --> approval["Waiting for approval"]:::state
  pay --> awaiting["Awaiting payment: countdown, Fawry code"]:::state
  approval --> confirmed
  awaiting --> confirmed
  confirmed --> listing["Listing opens (if players were asked)"]:::result
  pay --> failed["C6c Payment failed"]:::danger --> retry["Retry or change the method"] --> pay
  awaiting --> ranOut["C6c Payment window ran out"]:::state --> expired["Expired: slots released, Book again"]:::result
  approval --> notApproved["C6c Not approved in time"]:::state --> expired
```

### C6b Fully booked

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef result fill:#CDF4D3,stroke:#66D575
  none["No free slots at that time"] --> next["Next available time chips"]
  none --> waitlist["Join the waitlist: this ground or any, time window"]:::sheet --> told["Told when a slot frees up"]:::result
```

### C7 Bookings

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef danger fill:#FFCDC2,stroke:#FF7556
  tab["Bookings: Upcoming · Past"]:::hub --> card["Booking card"]
  tab --> regular["Regular's reservation: Confirm / Release"]:::state
  card & regular --> detail["Booking detail: status tracker, ground, time, money, players, share, directions, call"]
  detail --> cancel["Cancel: reason → refund preview → cancelled"]:::danger
  detail --> players["Need players? / Manage players (C8b)"]
  detail --> review["Review (after completed)"]
  detail --> again["Book again"]
  detail --> moved["C7b Moved by the venue: #quot;moved from Tue 9pm#quot;, reason"]:::state
  detail --> refund["C7b Refund: pending → refunded, amount, method"]:::state
  detail --> venueCancel["C7b Cancelled by the venue: full refund"]:::state
```

### C8 Games

Open games. The disclaimer is on the listing and the Join button.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  tab["Games: Near me · My games"]:::hub --> filters["Filters: sport, size, date, time, area"]:::sheet --> game["Game detail: spots left, note, cost share, booker's first name"]
  game --> join["Join (sign-in sheet if guest) + disclaimer"]:::sheet --> joined["Joined: booker's phone, players, reminder"]:::result
  joined --> leave["Leave the game"]:::danger
  tab --> history["C8c My games → Past: who came"] --> report["A no-show report against me"]:::state
  mine["C8b Booker: my booking → game"] --> needed["Raise or lower needed players (not below joined)"]
  mine --> roster["Players: first name, phone, #quot;showed up X of Y#quot;, joined when"]
  roster --> remove["Remove a player, report a no-show (48 h)"]:::danger
  mine --> off["Turn the listing off (only while nobody has joined)"]:::danger
```

### C9 Inbox

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  bell["Bell on Explore"] --> list["Notifications"] --> deep["Deep link: booking, game or venue"]
  list --> push["Push permission (asked after the first booking)"]:::sheet
```

### C10 Account

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  account["Account"]:::hub --> profile["Profile: name, avatar, phone, time zone"]
  account --> saved["Saved venues"]
  account --> loyalty["Loyalty cards → card detail"]
  account --> waitlists["C10b My waitlists → waitlist → leave"]
  account --> language["Language"]
  account --> opts["Notifications and opt-ins: venue offers, games near me"]
  account --> security["Security: password, two-factor, devices"]
  account --> signout["Sign out"]:::danger
  account --> del["Delete account"]:::danger
  del --> blocked["C10c Blocked: open bookings or an unpaid balance, with what to do"]:::state
  del --> confirm["C10c Confirm: password, then a WhatsApp code"]:::sheet --> deleted["Deleted; past bookings kept without the name or phone"]:::result
```

## Dashboard app

Expo, for venue staff. Screens and actions a member has no permission for are hidden (seven areas, each none, view or manage; owners manage everything).

### D1 Auth

Built in PR 1.U1.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  welcome["Welcome"] --> signup["Sign up: phone → WhatsApp code → name + password"] --> done["Signed up"]:::result
  welcome --> signin["Sign in: phone + password"] --> twofa["Two-factor code (if on)"]:::sheet
  welcome --> forgot["Forgot password"] --> reset["Owner → contact support; member → read-only warning → code → new password"]:::state
  done & twofa --> next["First run (D2) or Home (D6)"]
  signin --> blocked["D1b Suspended or banned: contact support"]:::danger
  twofa --> readonly["D1b Read-only on every venue after a reset: banner until the owner restores"]:::state
```

### D2 First run, D3 venue switcher, D4 creating a venue

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  pending["Pending invitations for my phone"] --> create["Create your venue"]
  pending --> code["Join with a code"]
  inviteLink["Invitation link /manage/invite/[code]"] --> invite
  code --> invite["Invitation: venue, inviter, permissions"]:::sheet --> answer["Accept or decline"]:::sheet --> joined["Joined → Home"]:::result
  press["D3 Long-press the Venue tab"] --> switcher["Switcher: venues with status pill and role"]:::sheet
  switcher --> switched["Switched; every tab shows that venue"]:::result
  switcher --> create
  create --> draft{{"D2b A draft already exists?"}}:::state
  draft -- yes --> resume["Continue that draft (D5)"]
  draft -- no --> name["D4 Name (Arabic or English)"] --> pin["Pin: map or Google Places search"] --> area["Confirm the suggested area"]:::state --> made["Draft created → setup checklist"]:::result
```

### D5 Setup checklist and review

The checklist is Home while the venue isn't live. Items are done in any order, each saved as real data.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  list["Checklist: done / missing / blocked"]:::hub
  list --> details["Details and translations, phone"]
  list --> location["Location"]
  list --> photos["Photos (3+): upload, reorder, cover"]
  list --> amenities["Amenities and prices"]
  list --> grounds["Grounds (D5e)"]
  list --> schedule["Weekly schedule: hours × tiers, copy to other grounds"]
  list --> layout["Layout editor (2+ grounds)"]
  list --> settings["Settings (D5c)"]
  list --> tax["Tax number"]
  list --> payout["Payout destination (D16c)"]
  list --> submit["Submit (owner)"] --> submitted["Submitted: withdraw, invite staff"]:::state
  submitted --> rejected["Rejected: reason → back to draft"]:::danger --> list
  submitted --> provisioning["Provisioning: Hagz finishes translations, tax"]:::state --> live["Live: Home becomes Today"]:::result
  live <--> paused["Pause (maintenance) / resume"]:::state
```

### D5c Settings

Setup → Settings is a grouped list; each group is its own screen. Saving applies at once and shows in Activity.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef result fill:#CDF4D3,stroke:#66D575
  settings["Settings"] --> rules["Booking rules: minimum notice, auto-confirm, payment window"]
  settings --> payments["Payments: cash, deposit %, or full online"]
  settings --> cancel["Cancellation: Flexible, Moderate, Strict or Custom"] --> tiers["Custom tiers editor: hours before kick-off → refund %, with a plain-language preview"]
  settings --> loyalty["Loyalty: stamps per free game, window"]
  settings --> regulars["Regulars: weeks ahead, confirmation window, reminder lead, discount on freed slots"]
  settings --> alerts["Fill alerts: lapsed after, regular threshold, alert hours, the three alerts on or off"]
  settings --> holds["Holds: minutes a staff hold lasts (5–60)"]
  settings --> team["Team defaults: permissions for new invitations"]
  rules & payments & cancel & tiers & loyalty & regulars & alerts & holds & team --> saved["Saved"]:::result
```

### D5e Grounds

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef danger fill:#FFCDC2,stroke:#FF7556
  list["Grounds list (drag to reorder)"] --> ground["Ground: sport, size, surface, environment, names in Arabic and English, tier prices"]
  ground --> length["Booking length: minimum and maximum slots"]
  ground --> maintenance["Maintenance: unbookable for now"]:::state
  ground --> del["Delete (kept for booking history)"]:::danger
```

### D6 Home (Today)

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef state fill:#FFECBD,stroke:#FFC943
  today["Today: money today (big figure), next bookings"]:::hub
  today --> approvals["Needs action: approvals"]:::state --> d10["Approvals (D10)"]
  today --> holds["Holds about to expire"]:::state --> d9["Booking detail (D9)"]
  today --> unanswered["Regulars who haven't answered"]:::state --> d9
  today --> empty["Empty slots to fill"]:::state --> fill["Fill a slot (D13b)"]
  today --> bell["Bell → inbox (D18)"]
```

### D7 Calendar

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  classDef state fill:#FFECBD,stroke:#FFC943
  cal["Calendar: day · week"]:::hub --> phone["Phone: ground chips + day timeline, swipe between grounds, all-grounds strip"]
  cal --> tablet["Tablet: a column per ground"]
  phone & tablet --> slot["Empty slot sheet: New booking · Hold · Block · Fill this slot"]:::sheet
  phone & tablet --> booking["Tap a booking → D9"]
  slot --> newBooking["New booking (D8)"]
  slot --> block["Block, or add a manual slot"]:::danger
  slot --> fill["Fill a slot (D13b)"]
  cal --> close["D7b Close dates"] --> range["Range: dates, hours, grounds, reason (Eid, Ramadan, match night)"]:::sheet
  range --> conflicts["Bookings inside the range: move or cancel each"]:::state
  range --> manual["Add manual slots for special hours"]
  conflicts & manual --> closed["Closed; customers see no slots"]:::result
```

### D8 New booking

Slot first.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  start["Empty slot, or + → slot picker"] --> length["Duration and ground check"] --> customer["Customer: search phone or name, or add new"]:::sheet --> summary["Extras + summary"]
  summary --> confirm["Confirm"]:::result
  summary --> hold["Hold: countdown, extend, release"]:::state
```

### D9 Booking detail and D10 approvals

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  detail["Booking: status, customer, ground, time, charges, payments, history"]
  detail --> decide["Approve / decline (reason)"]
  detail --> cash["Record cash"]
  detail --> finish["Completed / no-show"]
  detail --> move["Move or swap (D11)"]
  detail --> cancel["Cancel: reason → full refund"]:::danger
  detail --> regular["Regular: confirm / release / copy reminder link"]
  detail --> headcount["D9b Open game: joined players headcount"]
  detail --> chain["D9b History: moves and swaps"] --> undo["Undo a swap"]:::danger
  queue["D10 Pending bookings (from Home)"] --> request["Request: customer, time, money, deadline"]
  request --> approve["Approve"]:::result
  request --> decline["Decline with a reason"]:::danger
```

### D11 Move and swap

Pick mode.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef result fill:#CDF4D3,stroke:#66D575
  move["Move on a booking"] --> pick["Calendar in pick mode: free slots lit"]
  pick --> free["Tap a free slot → held at once"]
  pick --> taken["Tap a booked slot → offer a swap"]
  free & taken --> confirm["Confirm: old → new, price difference, reason"]:::sheet --> done["Moved or swapped; customers and joined players told"]:::result
```

### D12 Venue tab

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  venue["Venue (grouped list)"]:::hub
  venue --> customers["Customers and regulars (D13)"]
  venue --> team["Team (D14)"]
  venue --> marketing["Marketing (D15)"]
  venue --> setup["Setup: details, photos, grounds and schedules, layout, settings"]
  venue --> status["Status: pause / resume"]
  venue --> activity["Activity (D19)"]
```

### D13 Customers, regulars and filling slots

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  list["Customers: search, groups (lapsed, regular, other)"] --> customer["Customer: history, reliability, loyalty, call / WhatsApp"]
  customer --> make["Make regular: ground, weekday, hour, duration, start / end"] --> regular["Regular: weekly reservations, reliability, pause / end"]
  regular --> edit["D13c Edit time or ground"] --> change["New weekday, hour, duration or ground"]:::sheet
  change --> preview["Preview: unconfirmed weeks re-created, confirmed weeks stay, taken weeks skipped"]:::sheet --> saved["Saved; the customer is told the new time once"]:::result
  topup["D13d Top-up finds a week taken or blocked"] --> skipped["Notice: this week was skipped"]:::state
  skipped --> moveOther["Move the other booking, then retry"]
  skipped --> leave["Leave the week skipped"]
  slot["D13b Empty slot or a fill-a-slot alert"] --> candidates["Ranked candidates: lapsed, active (+ another slot), others, with reasons"]
  candidates --> callThem["Call or WhatsApp from own phone"]
  candidates --> offer["Send an offer push (opted-in app users)"]:::sheet
```

### D14 Team

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  members["Members: role, permission summary"]
  members --> member["Member: 7 areas × none / view / manage, presets"] --> saved["Saved"]:::result
  members --> invite["Invite: phone → permissions → preview message"] --> sent["Invitation sent: code + WhatsApp link"]:::result
  members --> pending["Pending invites: resend, revoke"]
  members --> restore["Restore permissions after a reset"]:::state
```

### D15 Marketing

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef danger fill:#FFCDC2,stroke:#FF7556
  marketing["Marketing"] --> codes["Discount codes"] --> create["Create: percent or amount, uses, expiry"]
  codes --> revoke["Revoke"]:::danger
  marketing --> loyalty["Loyalty: stamps, window"]
  marketing --> reviews["Reviews (read only)"]
```

### D16 Payments

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  tab["Payments: balance, earnings, recovered revenue"]:::hub
  tab --> insights["Earnings insights: by weekday, by ground"]
  tab --> ledger["Ledger → entry detail"]
  tab --> payouts["Payouts → payout detail"]
  tab --> refunds["Refunds"]
  tab --> owed["D16b You owe Hagz EGP X: why, from which bookings"]:::state --> how["How to pay: wire details, or ask for a cash collection"] --> settlements["Settlements recorded by Hagz"]
  tab --> destination["D16c Add destination: bank, wallet or InstaPay"] --> unverified["Unverified: no payouts until Hagz checks it"]:::state --> verified["Verified"]:::result
  tab --> invoices["D16c Invoices: Hagz commission VAT invoices by month"] --> pdf["Invoice: download PDF"]
```

### D17 Account, D18 inbox, D19 activity

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef danger fill:#FFCDC2,stroke:#FF7556
  account["Account"]:::hub --> profile["Profile, language"]
  account --> security["Security: password, two-factor, devices"]
  account --> notifications["Notifications, invitations"]
  account --> del["Delete account"]:::danger
  account --> signout["Sign out"]:::danger
  bell["D18 Bell on Home"] --> inbox["Notifications: approvals, fill alerts, regulars, staff changes, venue review"]
  inbox --> deep["Deep link to the booking, slot, member or checklist"]
  inbox --> push["Push permission (asked after the first sign-in)"]:::sheet
  activity["D19 Venue → Activity"] --> filter["Filter: type, member, dates"]:::sheet --> event["Event: who, what, before → after"]
```

## Public web

Next, server-rendered in `/ar` and `/en`. View only.

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  landing["W1 Landing: what Hagz is, app store badges"] --> areas["Browse areas"] --> area["Area page /eg/cairo/maadi: live venues"]
  landing --> byName["Search venues by name"]
  area & byName --> venue["W2 /venue/[slug]: photos, rating, grounds, amenities, policy, map, reviews"]
  venue --> times["Free times today (read only)"] --> app["Book in the app → opens the app or the store"]:::result
  shared["W3 /b/[code]: venue, ground, time"] --> game["Open game: spots left, Join"]:::state
  shared --> summary["Plain booking summary"]
  game & summary --> getApp["Opens the app, or #quot;Get the app#quot;"]:::result
  reminder["W4 Regular's reminder link (no sign-in)"] --> reservation["Reservation: ground, time, deadline"]
  reservation --> confirmed["Confirmed"]:::result
  reservation --> released["Released"]:::danger
  reservation --> stale["Expired or already answered"]:::state
  invite["W5 /manage/invite/[code]"] --> inviter["Venue and inviter"] --> dashboard["Opens the dashboard app, or the store"]:::result
```

## Admin web

Next, English only, desktop. Invite-only admins with email, password and an authenticator app. Every action is recorded.

### A1–A4 Sign-in, admins and venues

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef hub fill:#DCCCFF,stroke:#874FFF
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  signin["A1 Email + password"] --> setup["Authenticator setup: QR, first code"]:::sheet
  signin --> code["Authenticator code"]:::sheet
  setup & code --> home["Admin home: queues and counts"]:::hub
  admins["A2 Admins list"] --> inviteAdmin["Invite by email"] --> accept["Accept invitation page"]
  admins --> revoke["Revoke an invitation"]:::danger
  admins --> suspend["Suspend / reset authenticator"]:::danger
  queue["A3 Queue: submitted, oldest first"] --> review["Venue: checklist, owner, submission history"]
  review --> reject["Reject with a reason"]:::danger
  review --> approve["Approve → provisioning"] --> provision["Provision: translations, tax number, commission override, photos"] --> live["Go live"]:::result
  venues["A4 Venues in any status: search"] --> venue["Venue detail"]
  venue --> pause["Pause / resume"]
  venue --> history["History: each change, with revert"]
  venue --> transfer["Transfer ownership"]
```

### A5–A8 Reference data, support, money and moderation

```mermaid
flowchart LR
  classDef default fill:#FFFFFF,stroke:#B3B3B3
  classDef state fill:#FFECBD,stroke:#FFC943
  classDef sheet fill:#C2E5FF,stroke:#3DADFF
  classDef result fill:#CDF4D3,stroke:#66D575
  classDef danger fill:#FFCDC2,stroke:#FF7556
  reference["A5 Reference data"] --> markets["Marketplaces: currency, VAT, commission"]
  reference --> locations["Locations tree, with translations"]
  reference --> amenityOptions["Amenity options, with translations"]
  people["A6 Customers and staff: search by phone"] --> person["Account: sessions, memberships, bookings"]
  person --> suspend["Suspend / reactivate"]:::danger
  person --> ownerReset["Reset an owner's password (after an identity check)"]
  lookups["A7 Lookups"] --> bookings["Bookings + their events"] --> anyRefund["Cancel with any refund"]:::danger
  lookups --> payments["Payments: resolve stuck ones"]
  lookups --> runs["Payout runs"] --> payout["Payout detail"]
  lookups --> adjust["Ledger adjustments (with a note)"]
  owed["A7b Negative balances: venues by amount owed"] --> ledger["Venue ledger"] --> settle["Record settlement: amount, wire or cash, reference (an ADJUSTMENT)"]:::sheet --> updated["Balance updated; the venue sees it"]:::result
  destinations["A7c Destinations awaiting a check"] --> destination["Destination: holder, bank, account number"]
  destination --> verify["Verify (payouts can start)"]:::result
  destination --> invalid["Not valid: tell the venue to add another"]:::danger
  audit["A7d Nightly audit"] --> drift["Drift alerts: ledger vs payments, refunds, payouts"]:::state --> affected["Alert detail: affected entries"]
  moderation["A8 Moderation"] --> hide["Reviews: hide"]
  moderation --> reports["Game no-show reports: remove unfair ones"]
  moderation --> logs["Notification delivery logs"]
```
