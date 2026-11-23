import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "./text";

// The match ticket (Figma C8, 260:2 and 261:2), the bookings' signature element: a white card with a
// status line, the day and the hours big, the ground and the venue, then a dashed tear line with a
// notch cut into each edge, and the booking code beside what's paid where.

const NOTCH = 22;
// From the tear line's ends (inset 20) out to the card's edge, centred on its 1px border.
const NOTCH_OFFSET = -(20 + NOTCH / 2 + 1);

export function MatchTicket({
  status,
  day,
  range,
  ground,
  venue,
  code,
  codeLabel,
  priceLabel,
  price,
}: {
  // "Waiting for the venue" with a grey dot, "Confirmed" with a black one.
  status: { label: string; dot: "grey" | "black" };
  day: string;
  range: string;
  ground: string;
  venue: string;
  code: string;
  codeLabel: string;
  priceLabel: string;
  price: string;
}) {
  const { t } = useTranslation();
  // The day runs into the hours under it: "Thu 26 Nov," then "9 – 11 pm" (user, 2026-11-23). The
  // language's own comma, "،" in Arabic.
  const comma = t("formats.listComma").trimEnd();
  return (
    <View className="rounded-[20px] border border-border bg-white">
      <View className="gap-1 px-5 pt-5 pb-[18px]">
        <View className="flex-row items-center gap-1.5">
          <View
            className={`size-[7px] rounded-full ${status.dot === "black" ? "bg-ink" : "bg-ink-3"}`}
          />
          <Text className="text-caption leading-[18px] font-medium">{status.label}</Text>
        </View>
        <Text className="pt-2.5 text-heading font-semibold">{`${day}${comma}`}</Text>
        <Text className="text-heading font-semibold">{range}</Text>
        <Text className="pt-2 text-label leading-5 text-ink-2">{ground}</Text>
        <Text className="text-label leading-5 text-ink-2">{venue}</Text>
      </View>

      {/* The tear line: a dashed rule (a dashed box clipped to its top edge, since one dashed side
          doesn't draw on iOS) and the two notches over the card's edges. */}
      <View className="mx-5">
        <View className="h-px overflow-hidden">
          <View
            style={{ height: 2, borderWidth: 1, borderStyle: "dashed", borderColor: "#ebebeb" }}
          />
        </View>
        {[{ left: NOTCH_OFFSET }, { right: NOTCH_OFFSET }].map((side, index) => (
          <View
            key={index}
            pointerEvents="none"
            className="absolute rounded-full border border-border bg-white"
            style={{ ...side, top: -NOTCH / 2, width: NOTCH, height: NOTCH }}
          />
        ))}
      </View>

      <View className="flex-row items-end justify-between px-5 pt-4 pb-[18px]">
        <View className="gap-0.5">
          <Text className="text-caption leading-[18px] text-unit">{codeLabel}</Text>
          <Text className="text-[20px] leading-6 font-semibold tracking-[1.4px]">{code}</Text>
        </View>
        <View className="items-end">
          <Text className="text-caption leading-[18px] text-unit">{priceLabel}</Text>
          <Text className="text-button font-semibold">{price}</Text>
        </View>
      </View>
    </View>
  );
}
