// Amounts travel as integers in the currency's minor unit (piastres for EGP). This turns them into
// what a player reads, in Western digits whatever the app's language (the staff app's lib/money.ts).

// How many decimals the currency's minor unit has (EGP 2, KWD 3), from the phone's own currency
// data; 2 if it doesn't know the code.
const decimalsOf = (currency: string) => {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
};

// 60000 EGP → "600", 155000 → "1,550".
export const formatAmount = (minor: number, currency: string) => {
  const decimals = decimalsOf(currency);
  return (minor / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: decimals });
};

// 60000 EGP → "600 EGP": the amount first, as the user writes prices (2026-11-19).
export const formatPrice = (minor: number, currency: string) =>
  `${formatAmount(minor, currency)} ${currency}`;
