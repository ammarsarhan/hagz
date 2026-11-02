import { describe, expect, it } from "vitest";
import { errorMessage, shortErrorMessage } from "../src";

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

  it("says something went wrong for anything else, and offline when there was no answer", () => {
    expect(shortErrorMessage(problem("SOMETHING_NEW"), "en")).toBe("Something went wrong");
    expect(shortErrorMessage(new TypeError("Network request failed"), "en")).toBe("You're offline");
  });
});
