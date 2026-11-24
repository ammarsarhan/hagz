// Checking in at the venue (2026-11-22, user): from 15 minutes before kick-off until 30 minutes after.
// Pure: the window, and what the check-ins mean for a game.

const MINUTE_MS = 60_000;

export const CHECK_IN_OPENS_BEFORE_MINUTES = 15;
export const CHECK_IN_CLOSES_AFTER_MINUTES = 30;
// A QR code works this long; the app fetches a new one at half of it.
export const CODE_SECONDS = 60;
export const REFRESH_SECONDS = 30;

export const checkInWindow = (startsAt: Date) => ({
  opensAt: new Date(startsAt.getTime() - CHECK_IN_OPENS_BEFORE_MINUTES * MINUTE_MS),
  closesAt: new Date(startsAt.getTime() + CHECK_IN_CLOSES_AFTER_MINUTES * MINUTE_MS),
});

export const inCheckInWindow = (startsAt: Date, now: Date) => {
  const { opensAt, closesAt } = checkInWindow(startsAt);
  return now >= opensAt && now <= closesAt;
};

// The joining fee is due for the players checked in; if the venue checked in none of them, it's
// "unknown" and every joined player counts, so skipping the scans saves the venue nothing.
export const feePlayers = (joined: number, checkedIn: number) =>
  checkedIn > 0 ? checkedIn : joined;

// A joined player's game counts in their reliability only if the venue checked in at least one
// joined player, so a desk that never scans can't make anyone a no-show (bookerListing's SQL).
