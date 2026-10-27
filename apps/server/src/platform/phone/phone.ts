import { parsePhoneNumberFromString } from "libphonenumber-js/mobile";
import { AppError } from "@/platform/errors/app-error";

export interface MobileNumber {
  // Canonical form, used for storage, uniqueness and rate-limit keys: +201001234567.
  e164: string;
  // The calling code without "+", e.g. "20". Shared by several countries for +1, +7 and +44, so
  // per-country budgets key on this, not on `country`.
  callingCode: string;
  // ISO 3166-1 alpha-2 when it can be told; unreliable inside shared calling codes (+44 7911... can
  // come back as GG). Unique for every marketplace's code (EG +20, the Gulf states).
  country: string | undefined;
}

// Only international format: the app builds the number from a country picker, and guessing the
// country of a local number ("0100...") would be wrong for exactly the foreign numbers we accept.
// Spaces, dashes and brackets are fine. The mobile metadata rejects landlines, premium-rate and
// shared-cost numbers, which is what SMS-pumping fraud uses.
export const parseMobileNumber = (input: string): MobileNumber | undefined => {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+")) return undefined;
  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid()) return undefined;
  return { e164: parsed.number, callingCode: parsed.countryCallingCode, country: parsed.country };
};

export const requireMobileNumber = (input: string): MobileNumber => {
  const number = parseMobileNumber(input);
  if (!number) {
    throw new AppError({
      code: "INVALID_PHONE_NUMBER",
      status: 400,
      detail: "Enter a mobile number in international format, e.g. +20 100 123 4567.",
    });
  }
  return number;
};
