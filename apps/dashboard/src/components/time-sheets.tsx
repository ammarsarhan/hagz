import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { amountOf, cleanAmount, decimalsOf, formatAmount, minorOf } from "@/lib/money";
import { colors } from "@/lib/colors";
import { Button } from "./button";
import { Chip } from "./week-strip";
import { Field } from "./field";
import {
  IconBan,
  IconChevronRight,
  IconLock,
  IconPencil,
  IconPlus,
  IconRestore,
  IconTag,
} from "./icons";
import { MoneyField } from "./money-field";
import { SettingsRow } from "./settings-row";
import { Sheet } from "./sheet";
import { Text } from "./text";

// The calendar's free and closed times (Figma D16 635:2, user 2026-11-27). Long press (or tap) a
// free time, or Modify a few picked by dragging: New booking, Hold, Close, Change the price. A
// closed one: Reopen it, Edit the note, Change the price. What each row leads to opens once its
// sheet has slid away (the caller's onHidden).

export type FreeAction = "book" | "hold" | "close" | "price";
export type ClosedAction = "reopen" | "note" | "price";

const icon = (Icon: typeof IconPlus) => (
  <View className="size-9 items-center justify-center rounded-full bg-field">
    <Icon size={18} color={colors.ink} strokeWidth={1.75} />
  </View>
);
const chevron = <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.75} />;

export function FreeTimeSheet({
  title,
  count,
  price,
  holdMinutes,
  canBook,
  canClose,
  grounds,
  groundId,
  onGround,
  visible,
  onClose,
  onHidden,
  onPick,
}: {
  // "7 – 8 pm · Pitch 2".
  title: string;
  // Hours picked: one, or a few dragged across.
  count: number;
  // What one of them costs now, for its row ("600 EGP now").
  price: string;
  holdMinutes: number | null;
  // bookings: manage, and schedule: manage.
  canBook: boolean;
  canClose: boolean;
  // On All grounds, a time free on several: which one, as chips.
  grounds: { id: string; name: string }[];
  groundId: string;
  onGround: (id: string) => void;
  visible: boolean;
  onClose: () => void;
  onHidden: () => void;
  onPick: (action: FreeAction) => void;
}) {
  const { t } = useTranslation();
  const p = "screens.calendar.timeSheet";
  const rows = [
    ...(canBook
      ? [
          {
            action: "book" as const,
            icon: IconPlus,
            title: t(`${p}.book`),
            body: t(`${p}.bookBody`, { count }),
          },
          {
            action: "hold" as const,
            icon: IconLock,
            title: t(`${p}.hold`, { count }),
            body:
              holdMinutes === null
                ? t(`${p}.holdBodyPlain`, { count })
                : count === 1
                  ? t(`${p}.holdBody`, { count: holdMinutes })
                  : t(`${p}.holdBodyMany`, { count: holdMinutes }),
          },
        ]
      : []),
    ...(canClose
      ? [
          {
            action: "close" as const,
            icon: IconBan,
            title: t(`${p}.close`, { count }),
            body: t(`${p}.closeBody`, { count }),
          },
          {
            action: "price" as const,
            icon: IconTag,
            title: t(`${p}.price`),
            body: count === 1 ? t(`${p}.priceNow`, { price }) : t(`${p}.priceSame`),
          },
        ]
      : []),
  ];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-3 text-[22px] font-semibold leading-[1.27]">
        {title}
      </Text>
      {grounds.length > 1 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {grounds.map((ground) => (
            <Chip
              key={ground.id}
              label={ground.name}
              on={ground.id === groundId}
              onPress={() => onGround(ground.id)}
            />
          ))}
        </View>
      ) : null}
      <View className="mb-2">
        {rows.map((row, index) => (
          <SettingsRow
            key={row.action}
            title={row.title}
            body={row.body}
            leading={icon(row.icon)}
            trailing={chevron}
            onPress={() => onPick(row.action)}
            divider={index < rows.length - 1}
          />
        ))}
      </View>
    </Sheet>
  );
}

export function ClosedTimeSheet({
  title,
  price,
  hasNote,
  visible,
  onClose,
  onHidden,
  onPick,
}: {
  title: string;
  price: string;
  hasNote: boolean;
  visible: boolean;
  onClose: () => void;
  onHidden: () => void;
  onPick: (action: ClosedAction) => void;
}) {
  const { t } = useTranslation();
  const p = "screens.calendar.timeSheet";
  const rows = [
    {
      action: "reopen" as const,
      icon: IconRestore,
      title: t(`${p}.reopen`),
      body: t(`${p}.reopenBody`, { price }),
    },
    {
      action: "note" as const,
      icon: IconPencil,
      title: hasNote ? t(`${p}.editNote`) : t(`${p}.addNote`),
      body: t(`${p}.noteBody`),
    },
    {
      action: "price" as const,
      icon: IconTag,
      title: t(`${p}.price`),
      body: t(`${p}.priceReopens`, { price }),
    },
  ];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-3 text-[22px] font-semibold leading-[1.27]">
        {title}
      </Text>
      <View className="mb-2">
        {rows.map((row, index) => (
          <SettingsRow
            key={row.action}
            title={row.title}
            body={row.body}
            leading={icon(row.icon)}
            trailing={chevron}
            onPress={() => onPick(row.action)}
            divider={index < rows.length - 1}
          />
        ))}
      </View>
    </Sheet>
  );
}

// A price for each hour picked. Save stays grey until it differs from what they cost now.
export function PriceSheet({
  title,
  current,
  currency,
  visible,
  busy,
  onClose,
  onHidden,
  onSave,
}: {
  title: string;
  // What each costs now, when they all cost the same; null when they differ.
  current: number | null;
  currency: string;
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onHidden: () => void;
  onSave: (price: number) => void;
}) {
  const { t } = useTranslation();
  const decimals = decimalsOf(currency);
  const [price, setPrice] = useState(() => (current === null ? "" : amountOf(current, decimals)));
  const value = minorOf(price, decimals);
  const ready = Number.isFinite(value) && value >= 0 && value !== current;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.calendar.timeSheet.priceTitle")}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {t("screens.calendar.timeSheet.priceSheetBody", { time: title })}
      </Text>
      <MoneyField
        label={t("screens.calendar.timeSheet.priceLabel")}
        currency={currency}
        decimals={decimals}
        value={price}
        onChangeText={(text) => setPrice(cleanAmount(text, decimals))}
      />
      <View className="mt-2">
        <Button
          label={t("screens.calendar.timeSheet.save")}
          disabled={!ready}
          loading={busy}
          onPress={() => onSave(value)}
        />
      </View>
    </Sheet>
  );
}

// Closed hours' note for the team. Empty removes it; Save stays grey until it changes.
export function NoteSheet({
  note,
  visible,
  busy,
  onClose,
  onHidden,
  onSave,
}: {
  note: string | null;
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onHidden: () => void;
  onSave: (note: string | null) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(note ?? "");
  const next = text.trim() === "" ? null : text.trim();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.calendar.timeSheet.noteTitle")}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {t("screens.calendar.timeSheet.noteBody")}
      </Text>
      <Field
        label={t("screens.calendar.timeSheet.noteLabel")}
        value={text}
        onChangeText={setText}
        placeholder={t("screens.calendar.timeSheet.notePlaceholder")}
        maxLength={200}
      />
      <View className="mt-2">
        <Button
          label={t("screens.calendar.timeSheet.save")}
          disabled={next === note}
          loading={busy}
          onPress={() => onSave(next)}
        />
      </View>
    </Sheet>
  );
}

// "1,800 EGP".
export const moneyOf = (minor: number, currency: string) =>
  `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
