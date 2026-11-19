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

// 60000 EGP → "EGP 600", 155000 → "EGP 1,550": the code first, as Egyptian prices are written.
export const formatPrice = (minor: number, currency: string) => {
  const decimals = decimalsOf(currency);
  const amount = (minor / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
  return `${currency} ${amount}`;
};
