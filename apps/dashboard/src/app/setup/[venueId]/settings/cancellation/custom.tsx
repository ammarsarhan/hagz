import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Button } from "@/components/button";
import { IconChevronRight, IconPlus } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { StepScreen } from "@/components/step-screen";
import { SwipeRow, useSwipeRows } from "@/components/swipe-row";
import { Text } from "@/components/text";
import { Wheel, WheelBand, type WheelItem } from "@/components/wheel";
import { useCancellationFlow } from "@/lib/cancellation-flow";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import {
  MAXIMUM_CANCELLATION_TIERS,
  MAXIMUM_NOTICE_HOURS,
  nextTier,
  type CancellationTier,
} from "@/lib/settings";
import { push } from "@/lib/navigation";

// Choosing a cancellation policy, 2, for Custom only: the rules as rows (Figma "Refund staircase",
// its rows, 448:51), from the most notice to the least, each with a swatch as deep as its refund,
// and less notice than the last getting nothing (a grey row). Tapping a rule opens it on two wheels,
// notice and refund (Figma "Pick a number (wheel sheet)", 451:2); swiping it left deletes it (not
// the last). The wheels only offer what keeps the rules in order (less notice and no more back
// than the rule above, more than the rule below), so there's nothing to get wrong on Continue.
const MAX_HOURS = MAXIMUM_NOTICE_HOURS;
// The notice a wheel offers: every hour to a day and a half, then the steps people use.
const NOTICE_STEPS = [
  ...Array.from({ length: 36 }, (_, i) => i + 1),
  42,
  48,
  60,
  72,
  96,
  120,
  144,
  168,
  240,
  MAX_HOURS,
];
const PERCENT_STEPS = Array.from({ length: 21 }, (_, i) => i * 5);

// From the palest blue at a small refund to full blue at all of it; grey for none.
const PALE = [0xdc, 0xe5, 0xff];
const BLUE = [0x1f, 0x38, 0xed];
const swatchOf = (percent: number) => {
  if (percent <= 0) return colors.border;
  const mix = (i: number) => {
    const from = PALE[i] ?? 0;
    const to = BLUE[i] ?? 0;
    return Math.round(from + ((to - from) * percent) / 100)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(0)}${mix(1)}${mix(2)}`;
};

export default function CustomRules() {
  const { t } = useTranslation();
  const { venueId, customTiers, setCustomTiers } = useCancellationFlow();
  // Each rule keeps an id of its own, so a deleted rule's open row doesn't pass to the next one.
  const nextId = useRef(0);
  const withId = (tier: CancellationTier) => ({ ...tier, id: nextId.current++ });
  const [rules, setRules] = useState(() => customTiers.map(withId));
  const tiers: CancellationTier[] = rules.map(({ hours, refundPercent }) => ({
    hours,
    refundPercent,
  }));
  // The rule open on the wheels, kept while the sheet slides away so its contents don't vanish.
  const [editing, setEditing] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rows = useSwipeRows();
  const last = tiers[tiers.length - 1];
  // Another rule needs at least an hour less notice than the last.
  const canAdd = tiers.length < MAXIMUM_CANCELLATION_TIERS && (last?.hours ?? 2) > 1;

  const open = (index: number) => {
    if (rows.closeOpen()) return;
    setEditing(index);
    setSheetOpen(true);
  };

  const add = () => {
    setRules([...rules, withId(nextTier(last))]);
    setEditing(tiers.length);
    setSheetOpen(true);
  };

  const remove = (index: number, row: SwipeableMethods | null) => {
    Alert.alert(t("screens.setup.settings.custom.deleteTitle", { number: index + 1 }), undefined, [
      {
        text: t("screens.setup.settings.custom.cancel"),
        style: "cancel",
        onPress: () => {
          row?.close();
          rows.forget();
        },
      },
      {
        text: t("screens.setup.settings.custom.delete"),
        style: "destructive",
        onPress: () => {
          rows.forget();
          setRules(rules.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const when = (index: number) => {
    const tier = tiers[index];
    const before = tiers[index - 1];
    if (!tier) return "";
    return before
      ? t("screens.setup.settings.custom.betweenBefore", { from: tier.hours, count: before.hours })
      : t("screens.setup.settings.custom.orMoreBefore", { count: tier.hours });
  };

  return (
    <StepScreen
      title={t("screens.setup.settings.custom.title")}
      subtitle={t("screens.setup.settings.custom.subtitle")}
      footer={
        <Button
          label={t("common.actions.continue")}
          onPress={() => {
            setCustomTiers(tiers);
            push(`/setup/${venueId}/settings/cancellation/confirm`);
          }}
        />
      }
    >
      {/* Edge to edge so a swipe opens Delete at the screen's side; the lines stay inset. */}
      <View className="-mx-5">
        <View className="mx-5 h-px bg-border" />
        {tiers.map((tier, index) => {
          const back =
            tier.refundPercent > 0
              ? t("screens.setup.settings.custom.getsBack", { percent: tier.refundPercent })
              : t("screens.setup.settings.custom.noRefund");
          return (
            <Fragment key={rules[index]?.id ?? index}>
              <SwipeRow
                label={`${when(index)}, ${back}`}
                deleteLabel={t("screens.setup.settings.custom.delete")}
                canDelete={tiers.length > 1}
                onPress={() => open(index)}
                onOpen={rows.opened}
                onDelete={(row) => remove(index, row)}
              >
                <Swatch color={swatchOf(tier.refundPercent)} />
                <View className="flex-1">
                  <Text className="text-body font-medium leading-[1.33]">{when(index)}</Text>
                  <Text className="mt-0.5 text-caption leading-[1.38] text-ink-2">{back}</Text>
                </View>
                <IconChevronRight
                  size={18}
                  color={colors.ink3}
                  style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
                />
              </SwipeRow>
              <View className="mx-5 h-px bg-border" />
            </Fragment>
          );
        })}
        {/* What's left: less notice than the last rule, nothing back. Follows the rules; not a rule. */}
        {last && last.refundPercent > 0 ? (
          <>
            <View className="flex-row items-center gap-3 px-5 py-[15px]">
              <Swatch color={colors.border} />
              <View className="flex-1">
                <Text className="text-body font-medium leading-[1.33] text-ink-2">
                  {t("screens.setup.settings.custom.rest", { count: last.hours })}
                </Text>
                <Text className="mt-0.5 text-caption leading-[1.38] text-ink-2">
                  {t("screens.setup.settings.custom.noRefund")}
                </Text>
              </View>
            </View>
            <View className="mx-5 h-px bg-border" />
          </>
        ) : null}
      </View>

      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          onPress={add}
          className="flex-row items-center gap-2 self-start py-[18px] active:opacity-60"
        >
          <IconPlus size={24} color={colors.primary} strokeWidth={1.75} />
          <Text className="text-subtitle font-medium text-primary">
            {t("screens.setup.settings.custom.add")}
          </Text>
        </Pressable>
      ) : null}

      {editing !== null && tiers[editing] ? (
        <RuleSheet
          key={editing}
          visible={sheetOpen}
          number={editing + 1}
          tier={tiers[editing]}
          above={tiers[editing - 1]}
          below={tiers[editing + 1]}
          // Merged into the rule as it is now, not as this render saw it.
          onChange={(patch) =>
            setRules((current) =>
              current.map((rule, i) => (i === editing ? { ...rule, ...patch } : rule)),
            )
          }
          onClose={() => setSheetOpen(false)}
          onHidden={() => setEditing(null)}
        />
      ) : null}
    </StepScreen>
  );
}

function Swatch({ color }: { color: string }) {
  return <View className="me-0.5 size-3 rounded-[3px]" style={{ backgroundColor: color }} />;
}

// One rule on two wheels, notice and refund, each applied when it comes to rest: the sentence under
// the title says what it now means. Each wheel offers only what keeps the rule between its neighbours.
function RuleSheet({
  visible,
  number,
  tier,
  above,
  below,
  onChange,
  onClose,
  onHidden,
}: {
  visible: boolean;
  number: number;
  tier: CancellationTier;
  above: CancellationTier | undefined;
  below: CancellationTier | undefined;
  onChange: (patch: Partial<CancellationTier>) => void;
  onClose: () => void;
  onHidden: () => void;
}) {
  const { t } = useTranslation();
  // What the wheels are on, for the sentence; each wheel also hands its value to the screen.
  const [draft, setDraft] = useState(tier);
  const hoursLabel = (count: number) => t("screens.setup.settings.custom.hoursValue", { count });

  // Notice between the rule below (exclusive) and the one above (exclusive), with the rule's own
  // value kept even if it's off the usual steps.
  const minHours = (below?.hours ?? 0) + 1;
  const maxHours = Math.min((above?.hours ?? MAX_HOURS + 1) - 1, MAX_HOURS);
  const hours: WheelItem<number>[] = [...new Set([...NOTICE_STEPS, tier.hours])]
    .filter((h) => h >= minHours && h <= maxHours)
    .sort((a, b) => a - b)
    .map((h) => ({ value: h, label: hoursLabel(h) }));
  // Refund between the rule below's and the one above's, both included.
  const minPercent = below?.refundPercent ?? 0;
  const maxPercent = above?.refundPercent ?? 100;
  const percents: WheelItem<number>[] = [...new Set([...PERCENT_STEPS, tier.refundPercent])]
    .filter((p) => p >= minPercent && p <= maxPercent)
    .sort((a, b) => a - b)
    .reverse()
    .map((p) => ({
      value: p,
      label: t("screens.setup.settings.custom.percentValue", { percent: p }),
    }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.settings.custom.rule", { number })}
      </Text>
      <Text className="mt-2 text-subtitle text-ink-2">
        {draft.refundPercent > 0
          ? t("screens.setup.settings.custom.sheetBody", {
              hours: hoursLabel(draft.hours),
              percent: draft.refundPercent,
            })
          : t("screens.setup.settings.custom.sheetBodyNone", { hours: hoursLabel(draft.hours) })}
      </Text>

      <View className="mt-5 flex-row">
        <Text className="flex-1 text-center text-caption text-ink-3">
          {t("screens.setup.settings.custom.notice")}
        </Text>
        <Text className="flex-1 text-center text-caption text-ink-3">
          {t("screens.setup.settings.custom.refund")}
        </Text>
      </View>
      <View className="relative mt-1 flex-row">
        <WheelBand />
        <Wheel
          label={t("screens.setup.settings.custom.notice")}
          items={hours}
          value={tier.hours}
          onChange={(hours) => {
            setDraft((current) => ({ ...current, hours }));
            onChange({ hours });
          }}
        />
        <Wheel
          label={t("screens.setup.settings.custom.refund")}
          items={percents}
          value={tier.refundPercent}
          onChange={(refundPercent) => {
            setDraft((current) => ({ ...current, refundPercent }));
            onChange({ refundPercent });
          }}
        />
      </View>

      <View className="mt-6">
        <Button label={t("screens.setup.settings.custom.done")} onPress={onClose} />
      </View>
    </Sheet>
  );
}
