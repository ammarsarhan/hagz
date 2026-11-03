// Egyptian mobile numbers: the field holds the 10 digits after +20; the API wants E.164.
export const COUNTRY_CODE = "+20";
export const PHONE_DIGITS = 10;

export const toE164 = (digits: string) => `${COUNTRY_CODE}${digits}`;

export const isCompletePhone = (digits: string) => digits.length === PHONE_DIGITS;

// "+20 100 123 4567", for showing the number back in a sentence.
export const displayPhone = (digits: string) =>
  `${COUNTRY_CODE} ${[digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(" ")}`;

// Keeps a number reading left to right inside a right-to-left sentence (Unicode isolates).
export const isolate = (text: string) => `⁦${text}⁩`;
