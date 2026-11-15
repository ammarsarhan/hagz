// Amounts travel as integers in the currency's minor unit (piastres for EGP). These turn them into
// what a person types and reads, and back, in Western digits whatever the app's language.

// How many decimals the currency's minor unit has (EGP 2, KWD 3), from the phone's own currency
// data; 2 if it doesn't know the code.
export const decimalsOf = (currency: string) => {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
};

// For an input: 15000 → "150", 1550 → "15.5". No trailing zeros, since prices are mostly whole.
export const amountOf = (minor: number, decimals: number) =>
  String(Number((minor / 10 ** decimals).toFixed(decimals)));

// For reading: 110000 → "1,100", grouped like the rest of a price line.
export const formatAmount = (minor: number, decimals: number) =>
  (minor / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: decimals });

// What was typed, in minor units; NaN when there's nothing usable.
export const minorOf = (amount: string, decimals: number) =>
  amount.trim() === "" ? Number.NaN : Math.round(Number(amount) * 10 ** decimals);

// Keeps typing to digits and one decimal point, to the currency's precision.
export const cleanAmount = (text: string, decimals: number) => {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [whole = "", fraction] = cleaned.split(".");
  return fraction === undefined || decimals === 0
    ? whole
    : `${whole}.${fraction.slice(0, decimals)}`;
};
