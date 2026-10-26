import { describe, expect, it } from "vitest";
import { parseMobileNumber, requireMobileNumber } from "@/platform/phone/phone";

describe("parseMobileNumber", () => {
  it.each([
    ["+201001234567", "+201001234567", "20", "EG"],
    ["+20 100 123 4567", "+201001234567", "20", "EG"],
    ["  +20 (100) 123-4567 ", "+201001234567", "20", "EG"],
    ["+966501234567", "+966501234567", "966", "SA"],
    ["+971501234567", "+971501234567", "971", "AE"],
  ])("normalizes %j", (input, e164, callingCode, country) => {
    expect(parseMobileNumber(input)).toEqual({ e164, callingCode, country });
  });

  it("accepts foreign mobiles, keyed by calling code where countries share one", () => {
    expect(parseMobileNumber("+447911123456")).toMatchObject({
      e164: "+447911123456",
      callingCode: "44",
    });
  });

  it.each([
    ["an Egyptian landline", "+20223456789"],
    ["a UK premium-rate number", "+449098790000"],
    ["a local number without a country code", "01001234567"],
    ["a 00 international prefix", "00201001234567"],
    ["a number that is too short", "+20100123"],
    ["letters", "+20100abc4567"],
    ["an empty string", ""],
  ])("rejects %s", (_, input) => {
    expect(parseMobileNumber(input)).toBeUndefined();
  });
});

describe("requireMobileNumber", () => {
  it("throws a 400 the app can show", () => {
    expect(() => requireMobileNumber("+20223456789")).toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_PHONE_NUMBER" }),
    );
  });
});
