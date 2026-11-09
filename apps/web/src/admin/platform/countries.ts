import type { Locality } from "@hagz/contracts";

// The countries Hagz can open a marketplace in: the ones the Locality kinds were chosen for. Each
// fills in what the Add marketplace form would otherwise ask for. VAT is a starting point only;
// the admin confirms it before adding. Names come from the browser (Intl.DisplayNames), so they
// aren't repeated here.

export interface Country {
  code: string;
  currency: string;
  dialCode: string;
  timezone: string;
  // Standard VAT (or GST), in percent, at the time of writing.
  vat: number;
  // How the country is divided, top level first: the kinds offered when adding a location.
  kinds: Locality[];
}

export const countries: Country[] = [
  {
    code: "EG",
    currency: "EGP",
    dialCode: "+20",
    timezone: "Africa/Cairo",
    vat: 14,
    kinds: ["GOVERNORATE", "CITY", "DISTRICT", "AREA"],
  },
  {
    code: "SA",
    currency: "SAR",
    dialCode: "+966",
    timezone: "Asia/Riyadh",
    vat: 15,
    kinds: ["REGION", "CITY", "DISTRICT", "NEIGHBORHOOD"],
  },
  {
    code: "AE",
    currency: "AED",
    dialCode: "+971",
    timezone: "Asia/Dubai",
    vat: 5,
    kinds: ["EMIRATE", "CITY", "AREA", "NEIGHBORHOOD"],
  },
  {
    code: "QA",
    currency: "QAR",
    dialCode: "+974",
    timezone: "Asia/Qatar",
    vat: 0,
    kinds: ["MUNICIPALITY", "AREA"],
  },
  {
    code: "KW",
    currency: "KWD",
    dialCode: "+965",
    timezone: "Asia/Kuwait",
    vat: 0,
    kinds: ["GOVERNORATE", "AREA"],
  },
  {
    code: "BH",
    currency: "BHD",
    dialCode: "+973",
    timezone: "Asia/Bahrain",
    vat: 10,
    kinds: ["GOVERNORATE", "CITY", "AREA"],
  },
  {
    code: "OM",
    currency: "OMR",
    dialCode: "+968",
    timezone: "Asia/Muscat",
    vat: 5,
    kinds: ["GOVERNORATE", "WILAYAT", "AREA"],
  },
  {
    code: "JO",
    currency: "JOD",
    dialCode: "+962",
    timezone: "Asia/Amman",
    vat: 16,
    kinds: ["GOVERNORATE", "CITY", "DISTRICT", "AREA"],
  },
];

// Every kind, coarsest first. Orders the kind cards and decides what can sit inside what.
export const kindOrder: Locality[] = [
  "REGION",
  "EMIRATE",
  "GOVERNORATE",
  "MUNICIPALITY",
  "WILAYAT",
  "CITY",
  "DISTRICT",
  "AREA",
  "NEIGHBORHOOD",
];

const english = new Intl.DisplayNames(["en"], { type: "region" });
const arabic = new Intl.DisplayNames(["ar"], { type: "region" });

export const countryNames = (code: string) => ({
  en: english.of(code) ?? code,
  ar: arabic.of(code) ?? code,
});
