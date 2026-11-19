import type { CancellationTier } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";

// A cancellation policy in plain words for the venue page (PR 3.2), one sentence a line, so the app
// and the web say it the same way. Tiers come most notice first, refunds never rising
// (CancellationTiers), and less notice than the last tier refunds nothing.
//
// The tiers split the time before a booking into bands: from the first tier's hours up, between
// each tier and the one before it, and under the last. Neighbouring bands that refund the same are
// one band to a player ("50% back from 6 to 48 hours", not two lines), so they're merged first. A
// venue cancelling always refunds in full, which ends every summary.

interface Band {
  from: number; // Hours of notice, at least.
  to: number | null; // Under this many; null: no limit.
  refundPercent: number;
}

export const refundBands = (tiers: readonly CancellationTier[]): Band[] => {
  const bands: Band[] = [];
  let to: number | null = null;
  for (const tier of [...tiers, { hours: 0, refundPercent: 0 }]) {
    const last = bands.at(-1);
    if (last && last.refundPercent === tier.refundPercent) last.from = tier.hours;
    else bands.push({ from: tier.hours, to, refundPercent: tier.refundPercent });
    to = tier.hours;
  }
  return bands;
};

// Arabic counts its nouns: ساعة واحدة, ساعتين, 3–10 ساعات, then ساعة again from 11.
const hoursIn = (hours: number, language: Language) => {
  if (language === "EN") return hours === 1 ? "1 hour" : `${hours} hours`;
  if (hours === 1) return "ساعة واحدة";
  if (hours === 2) return "ساعتين";
  return hours <= 10 ? `${hours} ساعات` : `${hours} ساعة`;
};

const phrases = {
  EN: {
    free: (h: string) => `Free cancellation up to ${h} before it starts.`,
    atLeast: (p: number, h: string) => `${p}% back if you cancel ${h} or more before it starts.`,
    between: (p: number, from: number, to: string) =>
      `${p}% back if you cancel ${from} to ${to} before it starts.`,
    none: (h: string) => `No refund if you cancel less than ${h} before it starts.`,
    never: "No refunds once booked.",
    venue: "If the venue cancels, you get a full refund.",
  },
  AR: {
    free: (h: string) => `إلغاء مجاني حتى ${h} قبل الموعد.`,
    atLeast: (p: number, h: string) => `استرداد ${p}% عند الإلغاء قبل الموعد بـ${h} أو أكثر.`,
    between: (p: number, from: number, to: string) =>
      `استرداد ${p}% عند الإلغاء بين ${hoursIn(from, "AR")} و${to} قبل الموعد.`,
    none: (h: string) => `لا استرداد عند الإلغاء قبل الموعد بأقل من ${h}.`,
    never: "لا استرداد بعد الحجز.",
    venue: "إذا ألغى الملعب حجزك، تسترد المبلغ كاملًا.",
  },
} as const;

export const cancellationSummary = (
  tiers: readonly CancellationTier[],
  language: Language,
): string[] => {
  const say = phrases[language];
  const lines = refundBands(tiers).map(({ from, to, refundPercent: p }) => {
    if (to === null) {
      if (from === 0) return say.never;
      return p === 100 ? say.free(hoursIn(from, language)) : say.atLeast(p, hoursIn(from, language));
    }
    if (p === 0) return say.none(hoursIn(to, language));
    return say.between(p, from, hoursIn(to, language));
  });
  return [...lines, say.venue];
};
