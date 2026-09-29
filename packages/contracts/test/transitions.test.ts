import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, BOOKING_TRANSITIONS, canTransition, isFinalStatus, ROLES, type BookingActor } from "../src";

const ACTORS: BookingActor[] = [...ROLES, "system"];

describe("booking transitions", () => {
  it("allows exactly the transitions listed in the table", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        for (const actor of ACTORS) {
          const listed = BOOKING_TRANSITIONS[from].some((t) => t.to === to && t.by.includes(actor));
          expect(canTransition(from, to, actor), `${from} -> ${to} by ${actor}`).toBe(listed);
        }
      }
    }
  });

  it("never transitions a status to itself", () => {
    for (const from of BOOKING_STATUSES) {
      expect(BOOKING_TRANSITIONS[from].some((t) => t.to === from)).toBe(false);
    }
  });

  it("treats cancelled, rejected, expired, completed and no_show as final", () => {
    const final = BOOKING_STATUSES.filter(isFinalStatus);
    expect(final).toEqual(["cancelled", "rejected", "expired", "completed", "no_show"]);
  });
});
