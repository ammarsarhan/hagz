import { describe, expect, it } from "vitest";
import { setupChecklist, type SetupFacts } from "@/modules/venues/domain/setup";

// A draft straight after creation: a name, a pin, nothing else.
const fresh: SetupFacts = {
  status: "DRAFT",
  phone: null,
  translations: [{ name: "Champions Arena", description: null, address: null }],
  hasPin: true,
  cancellationPolicy: null,
  amenityCount: 0,
  taxNumber: null,
};

const complete: SetupFacts = {
  ...fresh,
  phone: "+201001234567",
  translations: [
    { name: "Champions Arena", description: "Three 5-a-side pitches.", address: "12 Street 9" },
  ],
  cancellationPolicy: "MODERATE",
};

const stateOf = (facts: SetupFacts, key: string) =>
  setupChecklist(facts).items.find((item) => item.key === key)?.state;

describe("setup checklist", () => {
  it("starts a new draft with only its location done", () => {
    const setup = setupChecklist(fresh);
    expect(setup.items.map((item) => [item.key, item.required, item.state])).toEqual([
      ["DETAILS", true, "MISSING"],
      ["LOCATION", true, "DONE"],
      ["SETTINGS", true, "MISSING"],
      ["AMENITIES", false, "MISSING"],
      ["TAX_NUMBER", false, "MISSING"],
    ]);
    expect(setup.required).toEqual({ done: 1, total: 3 });
    expect(setup.canSubmit).toBe(false);
  });

  it("can be submitted once every required item is done, optional ones aside", () => {
    const setup = setupChecklist(complete);
    expect(setup.required).toEqual({ done: 3, total: 3 });
    expect(setup.canSubmit).toBe(true);
  });

  it("only lets a draft be submitted", () => {
    for (const status of ["SUBMITTED", "PROVISIONING", "LIVE", "MAINTENANCE"] as const) {
      expect(setupChecklist({ ...complete, status }).canSubmit).toBe(false);
    }
  });

  describe("details", () => {
    it("need a phone", () => {
      expect(stateOf({ ...complete, phone: null }, "DETAILS")).toBe("MISSING");
      expect(stateOf({ ...complete, phone: "  " }, "DETAILS")).toBe("MISSING");
    });

    it("need name, description and address together in one language", () => {
      const split: SetupFacts = {
        ...complete,
        translations: [
          { name: "Champions Arena", description: "Three pitches.", address: null },
          { name: "ملعب الأبطال", description: null, address: "شارع 9" },
        ],
      };
      expect(stateOf(split, "DETAILS")).toBe("MISSING");
    });

    it("are done in Arabic alone", () => {
      const arabic: SetupFacts = {
        ...complete,
        translations: [{ name: "ملعب الأبطال", description: "ثلاثة ملاعب.", address: "شارع 9" }],
      };
      expect(stateOf(arabic, "DETAILS")).toBe("DONE");
    });

    it("don't count blank text", () => {
      const blank: SetupFacts = {
        ...complete,
        translations: [{ name: "Champions Arena", description: "   ", address: "12 Street 9" }],
      };
      expect(stateOf(blank, "DETAILS")).toBe("MISSING");
    });
  });

  it("needs a pin for the location", () => {
    expect(stateOf({ ...complete, hasPin: false }, "LOCATION")).toBe("MISSING");
  });

  it("counts settings done once a cancellation policy is chosen", () => {
    expect(stateOf({ ...complete, cancellationPolicy: null }, "SETTINGS")).toBe("MISSING");
    expect(stateOf({ ...complete, cancellationPolicy: "CUSTOM" }, "SETTINGS")).toBe("DONE");
  });

  it("marks the optional items done when there's something in them", () => {
    const extras = { ...complete, amenityCount: 2, taxNumber: "100-200-300" };
    expect(stateOf(extras, "AMENITIES")).toBe("DONE");
    expect(stateOf(extras, "TAX_NUMBER")).toBe("DONE");
    expect(setupChecklist(extras).required).toEqual({ done: 3, total: 3 });
  });

  it("blocks nothing yet", () => {
    expect(setupChecklist(fresh).items.every((item) => item.blockedBy === null)).toBe(true);
  });
});
