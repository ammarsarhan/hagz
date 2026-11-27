import { describe, expect, it } from "vitest";
import { errorMessage, retryAfter, shortErrorMessage } from "../src";

const problem = (code: string) => ({
  type: "about:blank",
  title: "",
  status: 400,
  code,
  detail: "",
});

describe("errorMessage", () => {
  it("translates known codes", () => {
    expect(errorMessage(problem("INVALID_CODE"), "en")).toBe("That code isn't right.");
    expect(errorMessage(problem("INVALID_CODE"), "ar")).toBe("الرمز غير صحيح.");
  });

  it("falls back to a generic message for codes it doesn't know", () => {
    expect(errorMessage(problem("SOMETHING_NEW"), "en")).toBe(
      "Something went wrong on our side. Please try again.",
    );
    expect(errorMessage(problem("toString"), "en")).toBe(
      "Something went wrong on our side. Please try again.",
    );
  });

  it("treats anything thrown as a connection problem", () => {
    expect(errorMessage(new TypeError("Network request failed"), "en")).toBe(
      "Couldn't reach Hagz. Check your connection and try again.",
    );
  });
});

describe("shortErrorMessage", () => {
  it("has a short line for problems that aren't the person's fault", () => {
    expect(shortErrorMessage(problem("MESSAGING_UNAVAILABLE"), "en")).toBe(
      "Couldn't send the code",
    );
    expect(shortErrorMessage(problem("CHALLENGE_EXPIRED"), "ar")).toBe("انتهت صلاحية التحقق");
  });

  it("says a refused save was the details, rather than something went wrong", () => {
    expect(shortErrorMessage(problem("VALIDATION_FAILED"), "en")).toBe("Check the details");
    expect(shortErrorMessage(problem("INVALID_GROUND"), "ar")).toBe("راجع تفاصيل الملعب");
  });

  it("asks to wait when rate limited, rather than saying something went wrong", () => {
    expect(shortErrorMessage(problem("RATE_LIMITED"), "en")).toBe("Wait a moment");
  });

  it("gives a pin too far from its area the API's limit, in km", () => {
    const far = { ...problem("PIN_FAR_FROM_AREA"), areaId: "a", distance: 23_400, limit: 15_000 };
    expect(shortErrorMessage(far, "en")).toBe("Pin is over 15 km from the area");
    expect(shortErrorMessage(far, "ar")).toBe("الدبوس أبعد من 15 كم عن المنطقة");
    expect(errorMessage(far, "en")).toBe(
      "The pin is more than 15 km from this area. Move it or pick another area.",
    );
    // No limit to fill in: the generic line rather than a "{km}".
    expect(shortErrorMessage(problem("PIN_FAR_FROM_AREA"), "en")).toBe("Something went wrong");
  });

  it("gives an at-once limit the API's number", () => {
    const limit = { ...problem("JOINING_LIMIT"), limit: 2 };
    expect(shortErrorMessage(limit, "en")).toBe("Only 2 games at once");
    expect(errorMessage(limit, "en")).toBe(
      "You can be in 2 games at a time. Play or leave one first.",
    );
    expect(shortErrorMessage(problem("PAY_AT_VENUE_LIMIT"), "en")).toBe("Something went wrong");
  });

  it("says why a game can't be marked a no-show, not that something went wrong", () => {
    expect(shortErrorMessage(problem("CHECKED_IN"), "en")).toBe(
      "They scanned in, so not a no-show",
    );
    expect(errorMessage(problem("MARK_WINDOW_CLOSED"), "en")).toBe(
      "A game can be marked until 24 hours after it ends.",
    );
  });

  it("says something went wrong for anything else, and offline when there was no answer", () => {
    expect(shortErrorMessage(problem("SOMETHING_NEW"), "en")).toBe("Something went wrong");
    expect(shortErrorMessage(new TypeError("Network request failed"), "en")).toBe("You're offline");
  });
});

describe("retryAfter", () => {
  it("reads the seconds a rate-limited request has to wait", () => {
    expect(retryAfter({ ...problem("RATE_LIMITED"), retryAfter: 48 })).toBe(48);
  });

  it("is undefined for other problems, a missing value, or no answer at all", () => {
    expect(retryAfter({ ...problem("INVALID_CODE"), retryAfter: 48 })).toBeUndefined();
    expect(retryAfter(problem("RATE_LIMITED"))).toBeUndefined();
    expect(retryAfter(new TypeError("Network request failed"))).toBeUndefined();
  });
});
