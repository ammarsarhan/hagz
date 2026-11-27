import { localDateOf, type Slot } from "./calendar";

// Where a booking can move to on a day (Figma D9 605:2): every start on a ground from which the
// booking's length runs over back-to-back slots that are free, or are its own (a move an hour
// later on the same ground keeps the hour they share). Not its own start, nothing already begun,
// and on one ground when one is picked. Each with the price of its slots, which the moved booking
// costs (docs/rescheduling.md).

export interface MoveTarget {
  key: string;
  groundId: string;
  startsAt: string;
  endsAt: string;
  price: number;
  // Runs over some of the booking's own slots: those can't be held (its booking keeps them), so
  // the move goes ahead without a hold.
  overlapsOwn: boolean;
}

export const moveTargets = ({
  booking,
  slots,
  date,
  timezone,
  now,
  groundId,
  ownHolds = [],
}: {
  booking: { id: string; startsAt: string; endsAt: string; ground: { id: string } };
  slots: readonly Slot[];
  date: string;
  timezone: string;
  now: number;
  groundId: string | null;
  // Holds this screen put on its picked times: free to it, so picking one doesn't redraw the day.
  ownHolds?: readonly string[];
}): MoveTarget[] => {
  const length = Date.parse(booking.endsAt) - Date.parse(booking.startsAt);
  const byGround = new Map<string, Slot[]>();
  for (const slot of slots)
    byGround.set(slot.groundId, [...(byGround.get(slot.groundId) ?? []), slot]);
  const usable = (slot: Slot) =>
    slot.status === "AVAILABLE" ||
    slot.bookingId === booking.id ||
    (slot.bookingId !== null && ownHolds.includes(slot.bookingId));

  const targets: MoveTarget[] = [];
  for (const [ground, list] of byGround) {
    if (groundId !== null && ground !== groundId) continue;
    list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    list.forEach((first, index) => {
      const start = Date.parse(first.startsAt);
      if (localDateOf(first.startsAt, timezone) !== date || start <= now) return;
      if (ground === booking.ground.id && start === Date.parse(booking.startsAt)) return;
      let end = start;
      let price = 0;
      let overlapsOwn = false;
      for (let next = index; end < start + length; next++) {
        const slot = list[next];
        if (!slot || Date.parse(slot.startsAt) !== end || !usable(slot)) return;
        price += slot.price;
        if (slot.bookingId === booking.id) overlapsOwn = true;
        end = Date.parse(slot.endsAt);
      }
      if (end !== start + length) return;
      targets.push({
        key: `${ground}|${first.startsAt}`,
        groundId: ground,
        startsAt: first.startsAt,
        endsAt: new Date(end).toISOString(),
        price,
        overlapsOwn,
      });
    });
  }
  return targets;
};
