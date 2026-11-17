// "EGP 50", "AED 12.50", "KWD 1.500": an amount in the currency's minor units. The currency's own
// decimals (2 for EGP, 3 for KWD) say how many minor units make one, and whole amounts drop them.
export const formatMoney = (currency: string, minor: number) => {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const amount = minor / 10 ** digits;
  const text = new Intl.NumberFormat("en", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${currency} ${text}`;
};
