const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

// "3 hours ago", "in 31 hours", "now": for when it happened, not the clock time.
export const fromNow = (iso: string, now = Date.now()) => {
  const diff = new Date(iso).getTime() - now;
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "now";
};
