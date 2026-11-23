import { refundBands, type CancellationTier } from "@hagz/contracts";
import type { components } from "@hagz/api";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { formatPrice } from "@/lib/money";
import { hoursLabel, momentLabel, timeRange } from "@/lib/venue";
import { Text } from "./text";
import { GroupHeading, Hairline } from "./venue-sections";

// What Review (before booking) and the booking page (after) both show: the price line by line,
// and what comes back if the player cancels. Sections are split by a hairline with 22 above it and
// 20 below.

type Charge = components["schemas"]["BookingCharge"];

const HOUR = 3_600_000;

export function SectionBreak() {
  return (
    <View className="mt-[22px] mb-5">
      <Hairline />
    </View>
  );
}

// The price: a line an hour ("7 – 8 am": from its start to the next hour's, or to the booking's end
// for the last), one per extra, the service fee, then the total and
// a grey line on VAT and how it's paid.
export function PriceSection({
  charges,
  endsAt,
  total,
  currency,
  timezone,
  note,
}: {
  charges: Charge[];
  // When the booking ends, which the last hour runs to.
  endsAt: string;
  total: number;
  currency: string;
  timezone: string;
  note: string;
}) {
  const { t } = useTranslation();
  const starts = charges
    .flatMap((charge) => (charge.type === "SLOT" && charge.startsAt ? [charge.startsAt] : []))
    .sort();
  const hourOf = (startsAt: string) =>
    timeRange(startsAt, starts.find((start) => start > startsAt) ?? endsAt, timezone);
  return (
    <View className="gap-2">
      <View className="pb-1.5">
        <GroupHeading>{t("screens.review.price")}</GroupHeading>
      </View>
      {charges.map((charge, index) => (
        <View key={index} className="flex-row justify-between gap-4">
          <Text className="shrink text-body leading-[22px] text-ink-2">
            {charge.type === "SLOT" && charge.startsAt
              ? hourOf(charge.startsAt)
              : charge.type === "SERVICE_FEE"
                ? t("screens.review.serviceFee")
                : (charge.amenity?.name ?? "")}
          </Text>
          <Text className="text-body leading-[22px]">{formatPrice(charge.amount, currency)}</Text>
        </View>
      ))}
      <View className="py-1.5">
        <Hairline />
      </View>
      <View className="flex-row justify-between gap-4">
        <Text className="text-body leading-[22px] font-semibold">{t("screens.review.total")}</Text>
        <Text className="text-body leading-[22px] font-semibold">
          {formatPrice(total, currency)}
        </Text>
      </View>
      <Text className="text-caption text-unit">{note}</Text>
    </View>
  );
}

// The cancellation tiers as rows: until when each refund lasts, counted back from kick-off at the
// venue's clock, and how much comes back. Windows that have already closed are left out.
export const cancelRows = (
  tiers: CancellationTier[],
  startsAt: string,
  timezone: string,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  const start = Date.parse(startsAt);
  const before = (hours: number) => new Date(start - hours * HOUR).toISOString();
  const back = (percent: number) =>
    percent === 100
      ? t("screens.review.cancel.everything")
      : percent === 50
        ? t("screens.review.cancel.half")
        : percent === 0
          ? t("screens.review.cancel.nothing")
          : t("screens.review.cancel.percent", { percent });
  return refundBands(tiers)
    .filter((band) => band.from === 0 || start - band.from * HOUR > Date.now())
    .map((band) => ({
      key: band.from,
      when:
        band.from > 0
          ? t("screens.review.cancel.until", { moment: momentLabel(before(band.from), timezone) })
          : band.to === null
            ? t("screens.review.cancel.always")
            : t("screens.review.cancel.after", { moment: momentLabel(before(band.to), timezone) }),
      line:
        band.from > 0
          ? t("screens.review.cancel.orMore", { hours: hoursLabel(band.from) })
          : band.to === null
            ? null
            : t("screens.review.cancel.lessThan", { hours: hoursLabel(band.to) }),
      back: back(band.refundPercent),
    }));
};

// If you cancel: each refund's deadline, counted back from kick-off. Nothing when no window is left.
export function CancelSection({
  tiers,
  startsAt,
  timezone,
  divided = true,
}: {
  tiers: CancellationTier[];
  startsAt: string;
  timezone: string;
  // With the hairline above it.
  divided?: boolean;
}) {
  const { t } = useTranslation();
  const rows = cancelRows(tiers, startsAt, timezone, t);
  if (rows.length === 0) return null;
  return (
    <>
      {divided ? <SectionBreak /> : null}
      <View>
        <View className="pb-1.5">
          <GroupHeading>{t("screens.review.cancel.title")}</GroupHeading>
        </View>
        {rows.map((row, index) => (
          <View
            key={row.key}
            className={`flex-row items-start justify-between gap-4 py-3.5 ${index < rows.length - 1 ? "border-b border-border" : ""}`}
          >
            <View className="shrink gap-0.5">
              <Text className="text-body font-medium">{row.when}</Text>
              {row.line ? <Text className="text-caption text-unit">{row.line}</Text> : null}
            </View>
            <Text className="text-body">{row.back}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
