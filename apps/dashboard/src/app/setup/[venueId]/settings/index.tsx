import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, TextInput, View } from "react-native";
import { Button } from "@/components/button";
import {
  ChoicePill,
  ChoicePills,
  RadioMark,
  SelectionBox,
  useSelection,
} from "@/components/choices";
import { Collapse } from "@/components/collapse";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { FieldBox, inputClass } from "@/components/field";
import { GroupHeading } from "@/components/group-heading";
import { IconAlertTriangle, IconChevronRight } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { SettingsRow } from "@/components/settings-row";
import { Sheet } from "@/components/sheet";
import { Stepper } from "@/components/stepper";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { queries } from "@/lib/queries";
import {
  DEFAULT_DEPOSIT_PERCENT,
  DEPOSIT_PERCENT,
  DEFAULT_LOYALTY,
  LOYALTY_STAMPS,
  LOYALTY_WINDOWS,
  NOTICE_CHOICES,
  PAYMENT_MODES,
  noticeLabel,
  paymentLabel,
  type MinimumNotice,
  type PaymentMode,
} from "@/lib/settings";
import { useSaveSettings, type VenueDetail } from "@/lib/venue-edit";
import { push } from "@/lib/navigation";

// Setup item "Policy" (Figma "Payments · A Plain list", 326:2), laid out like the account screen's
// groups (user, 2026-11-15): its headings and rows, each value on the grey line under its title. No
// Save button. Each change is saved as it's made; the two choices with more to
// them open sheets ("How players pay", 318:2, and when booking closes), and the cancellation policy
// has screens of its own (settings/cancellation).
export default function SetupSettings() {
  const { venueId = "", from } = useLocalSearchParams<{ venueId: string; from?: string }>();
  const venue = useQuery(queries.venue(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  return <SettingsList venueId={venueId} venue={venue.data} fromVenue={from === "venue"} />;
}

// From the Venue tab (Payments), the cancellation policy is left out: the tab has its own
// Cancellations row (user, 2026-11-26). Setup's checklist item keeps it.
function SettingsList({
  venueId,
  venue,
  fromVenue,
}: {
  venueId: string;
  venue: VenueDetail;
  fromVenue: boolean;
}) {
  const { t } = useTranslation();
  const compact = useCompactTitle();
  const save = useSaveSettings(venueId);
  const { settings } = venue;
  const [choosingNotice, setChoosingNotice] = useState(false);
  const [paying, setPaying] = useState(false);
  // A fresh "How players pay" sheet each time, starting from what's saved.
  const [paymentKey, setPaymentKey] = useState(0);
  const [depositing, setDepositing] = useState(false);
  const [depositKey, setDepositKey] = useState(0);
  const [rewarding, setRewarding] = useState(false);
  const [loyaltyKey, setLoyaltyKey] = useState(0);
  const loyalty = settings.loyalty ?? DEFAULT_LOYALTY;
  const policy = settings.cancellationPolicy;
  // Named as the Venue tab's row that opened it.
  const title = fromVenue
    ? t("screens.venueTab.payments")
    : t("screens.setup.items.SETTINGS.title");
  // As on the account screen.
  const chevron = (
    <IconChevronRight
      size={18}
      color={colors.unit}
      strokeWidth={2}
      style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );

  return (
    <Screen>
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          subtitle={t(
            fromVenue ? "screens.setup.settings.venueSubtitle" : "screens.setup.settings.subtitle",
          )}
          onTitleLayout={compact.onTitleLayout}
        >
          {title}
        </Title>

        <GroupHeading className="mb-1">{t("screens.setup.settings.bookings")}</GroupHeading>
        <SettingsRow
          title={t("screens.setup.settings.autoConfirm")}
          body={t("screens.setup.settings.autoConfirmBody")}
          trailing={
            <Switch
              accessibilityLabel={t("screens.setup.settings.autoConfirm")}
              value={settings.autoConfirm}
              onValueChange={(autoConfirm) => void save({ autoConfirm })}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        <SettingsRow
          title={t("screens.setup.settings.closes")}
          body={noticeLabel(t, settings.minimumNotice)}
          trailing={chevron}
          onPress={() => setChoosingNotice(true)}
        />

        <GroupHeading className="mb-1 mt-9">{t("screens.setup.settings.payments")}</GroupHeading>
        <SettingsRow
          title={t("screens.setup.settings.howPlayersPay")}
          body={paymentLabel(t, settings.paymentMode)}
          trailing={chevron}
          onPress={() => {
            setPaymentKey((key) => key + 1);
            setPaying(true);
          }}
        />
        {/* The deposit's share, under the choice while players pay one, like loyalty's terms. */}
        <Collapse open={settings.paymentMode === "DEPOSIT"}>
          <SettingsRow
            title={t("screens.setup.settings.payment.deposit")}
            body={t("screens.setup.settings.payment.depositRow", {
              percent: settings.depositPercent ?? DEFAULT_DEPOSIT_PERCENT,
            })}
            trailing={chevron}
            onPress={() => {
              setDepositKey((key) => key + 1);
              setDepositing(true);
            }}
          />
        </Collapse>

        {fromVenue ? null : (
          <>
            <GroupHeading className="mb-1 mt-9">
              {t("screens.setup.settings.cancellations")}
            </GroupHeading>
            <SettingsRow
              title={t("screens.setup.settings.policy")}
              // Until one is chosen, its line says it's required, after a warning sign (ink: the staff
              // app marks what's needed by icon and weight, not colour). It's the one setting review
              // needs.
              body={
                policy
                  ? t(`screens.setup.settings.cancellation.policies.${policy}.title`)
                  : t("screens.setup.settings.policyRequired")
              }
              bodyIcon={
                policy ? undefined : (
                  <IconAlertTriangle size={14} color={colors.ink} strokeWidth={2} />
                )
              }
              trailing={chevron}
              onPress={() => push(`/setup/${venueId}/settings/cancellation`)}
            />
          </>
        )}

        <GroupHeading className="mb-1 mt-9">{t("screens.setup.settings.loyalty")}</GroupHeading>
        <SettingsRow
          title={t("screens.setup.settings.rewardRegulars")}
          body={t("screens.setup.settings.rewardRegularsBody")}
          trailing={
            <Switch
              accessibilityLabel={t("screens.setup.settings.rewardRegulars")}
              value={settings.loyalty !== null}
              onValueChange={(on) => void save({ loyalty: on ? DEFAULT_LOYALTY : null })}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        {/* Its terms, under the switch while it's on, as iOS settings show a switch's options. */}
        <Collapse open={settings.loyalty !== null}>
          <SettingsRow
            title={t("screens.setup.settings.reward")}
            body={t("screens.setup.settings.rewardBody", {
              count: loyalty.stamps,
              days: loyalty.windowDays,
              ordinal: true,
            })}
            trailing={chevron}
            onPress={() => {
              setLoyaltyKey((key) => key + 1);
              setRewarding(true);
            }}
          />
        </Collapse>
      </FadingScroll>

      <NoticeSheet
        visible={choosingNotice}
        value={settings.minimumNotice}
        onClose={() => setChoosingNotice(false)}
        onChoose={(minimumNotice) => {
          setChoosingNotice(false);
          if (minimumNotice !== settings.minimumNotice) void save({ minimumNotice });
        }}
      />
      <PaymentSheet
        // Siblings share one key space: each sheet's name keeps them apart.
        key={`payment-${paymentKey}`}
        visible={paying}
        mode={settings.paymentMode}
        depositPercent={settings.depositPercent}
        onClose={() => setPaying(false)}
        onSave={(change) => {
          setPaying(false);
          void save(change);
        }}
      />
      <DepositSheet
        key={`deposit-${depositKey}`}
        visible={depositing}
        percent={settings.depositPercent ?? DEFAULT_DEPOSIT_PERCENT}
        onClose={() => setDepositing(false)}
        onSave={(depositPercent) => {
          setDepositing(false);
          void save({ depositPercent });
        }}
      />
      <LoyaltySheet
        key={`loyalty-${loyaltyKey}`}
        visible={rewarding}
        loyalty={loyalty}
        onClose={() => setRewarding(false)}
        onSave={(next) => {
          setRewarding(false);
          void save({ loyalty: next });
        }}
      />
    </Screen>
  );
}

// When booking closes: one of a fixed list (NOTICE_CHOICES). Not drawn in Figma; a plain list of
// the choices, like the cancellation policies, and choosing one saves it and closes the sheet.
function NoticeSheet({
  visible,
  value,
  onClose,
  onChoose,
}: {
  visible: boolean;
  value: MinimumNotice;
  onClose: () => void;
  onChoose: (minutes: MinimumNotice) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="mb-2 text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.settings.closes")}
      </Text>
      <View accessibilityRole="radiogroup">
        {NOTICE_CHOICES.map((minutes, i) => (
          <Pressable
            key={minutes}
            accessibilityRole="radio"
            accessibilityState={{ selected: minutes === value }}
            onPress={() => onChoose(minutes)}
            className={`flex-row items-center gap-3 py-3.5 active:opacity-60 ${i === NOTICE_CHOICES.length - 1 ? "" : "border-b border-border"}`}
          >
            <Text className="flex-1 text-subtitle">{noticeLabel(t, minutes)}</Text>
            <RadioMark selected={minutes === value} />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// How players pay (Figma 318:2): three cards, the chosen one blue on a blue tint. A deposit needs
// its share, so choosing it opens a field under its card (not drawn in Figma). Done saves, and
// stays grey until something differs from what's saved.
function PaymentSheet({
  visible,
  mode: savedMode,
  depositPercent,
  onClose,
  onSave,
}: {
  visible: boolean;
  mode: PaymentMode;
  depositPercent: number | null;
  onClose: () => void;
  onSave: (change: { paymentMode: PaymentMode; depositPercent: number | null }) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(savedMode);

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text
        accessibilityRole="header"
        className="mb-4 px-1 text-[22px] font-semibold leading-[1.27] tracking-[-0.3px]"
      >
        {t("screens.setup.settings.howPlayersPay")}
      </Text>
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {PAYMENT_MODES.map((option) => (
          <PaymentCard
            key={option}
            mode={option}
            selected={option === mode}
            onPress={() => setMode(option)}
          />
        ))}
      </View>
      <Text className="px-1 pb-[18px] pt-3.5 text-caption text-ink-2">
        {t("screens.setup.settings.payment.payoutNote")}
      </Text>
      <Button
        label={t("screens.setup.settings.payment.done")}
        disabled={mode === savedMode}
        onPress={() =>
          onSave({
            paymentMode: mode,
            // A deposit needs its share: the one saved, or a starting one to change on the
            // Deposit row.
            depositPercent: mode === "DEPOSIT" ? (depositPercent ?? DEFAULT_DEPOSIT_PERCENT) : null,
          })
        }
      />
    </Sheet>
  );
}

// The deposit's share of the price (not drawn in Figma), opened from the Deposit row that shows
// under "How players pay" while players pay a deposit. Done saves, grey until it changes.
function DepositSheet({
  visible,
  percent: saved,
  onClose,
  onSave,
}: {
  visible: boolean;
  percent: number;
  onClose: () => void;
  onSave: (percent: number) => void;
}) {
  const { t } = useTranslation();
  const [percent, setPercent] = useState(String(saved));
  const [focused, setFocused] = useState(false);
  const value = Number(percent);
  const valid = percent !== "" && value >= DEPOSIT_PERCENT.min && value <= DEPOSIT_PERCENT.max;

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="mb-4 text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.settings.payment.deposit")}
      </Text>
      <FieldBox focused={focused} error={false} ltr>
        <TextInput
          accessibilityLabel={t("screens.setup.settings.payment.deposit")}
          className={inputClass}
          value={percent}
          onChangeText={(text) => setPercent(text.replace(/\D/g, "").slice(0, 2))}
          keyboardType="number-pad"
          placeholder={String(DEFAULT_DEPOSIT_PERCENT)}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ textAlign: "left", writingDirection: "ltr" }}
        />
        <Text className="text-body text-ink-2">%</Text>
      </FieldBox>
      <Text className="mt-1.5 text-label leading-[1.43] text-ink-2">
        {percent !== "" && !valid
          ? t("screens.setup.settings.payment.depositRange", DEPOSIT_PERCENT)
          : t("screens.setup.settings.payment.depositHint")}
      </Text>
      <View className="mt-6">
        <Button
          label={t("screens.setup.settings.payment.done")}
          disabled={!valid || value === saved}
          onPress={() => onSave(value)}
        />
      </View>
    </Sheet>
  );
}

function PaymentCard({
  mode,
  selected,
  onPress,
}: {
  mode: PaymentMode;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const progress = useSelection(selected);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
    >
      <SelectionBox progress={progress} radius={16} />
      <View className="flex-1">
        <Text className="text-subtitle font-medium">
          {t(`screens.setup.settings.payment.modes.${mode}.title`)}
        </Text>
        <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
          {t(`screens.setup.settings.payment.modes.${mode}.body`)}
        </Text>
      </View>
      <RadioMark selected={selected} />
    </Pressable>
  );
}

// The loyalty reward's terms (not drawn in Figma): which booking in a row is free, on a stepper as
// a ground's booking length is, and how long bookings count, as pills of a few round lengths (any
// day from 1 to 365 would be a long way to step). Done saves, grey until something changes.
function LoyaltySheet({
  visible,
  loyalty,
  onClose,
  onSave,
}: {
  visible: boolean;
  loyalty: { stamps: number; windowDays: number };
  onClose: () => void;
  onSave: (next: { stamps: number; windowDays: number }) => void;
}) {
  const { t } = useTranslation();
  const [stamps, setStamps] = useState(loyalty.stamps);
  const [windowDays, setWindowDays] = useState(loyalty.windowDays);
  // A window set some other way (the API takes any) stays choosable.
  const windows = [...new Set<number>([...LOYALTY_WINDOWS, loyalty.windowDays])].sort(
    (a, b) => a - b,
  );
  const changed = stamps !== loyalty.stamps || windowDays !== loyalty.windowDays;

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="mb-2 text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.settings.rewardRegulars")}
      </Text>
      <SettingsRow
        title={t("screens.setup.settings.loyaltySheet.nth")}
        body={t("screens.setup.settings.loyaltySheet.nthBody")}
        trailing={
          <Stepper
            value={stamps}
            min={LOYALTY_STAMPS.min}
            max={LOYALTY_STAMPS.max}
            format={(count) =>
              t("screens.setup.settings.loyaltySheet.nthValue", { count, ordinal: true })
            }
            label={t("screens.setup.settings.loyaltySheet.nth")}
            decreaseLabel={t("screens.setup.settings.loyaltySheet.earlier")}
            increaseLabel={t("screens.setup.settings.loyaltySheet.later")}
            onChange={setStamps}
          />
        }
      />
      <View className="mb-3 mt-4">
        <Text className="text-[15px] font-medium leading-[1.33]">
          {t("screens.setup.settings.loyaltySheet.window")}
        </Text>
        <Text className="mt-0.5 text-caption text-ink-2">
          {t("screens.setup.settings.loyaltySheet.windowBody")}
        </Text>
      </View>
      <ChoicePills>
        {windows.map((days) => (
          <ChoicePill
            key={days}
            label={t("screens.setup.settings.loyaltySheet.days", { count: days })}
            selected={days === windowDays}
            onPress={() => setWindowDays(days)}
          />
        ))}
      </ChoicePills>
      <View className="mt-6">
        <Button
          label={t("screens.setup.settings.loyaltySheet.done")}
          disabled={!changed}
          onPress={() => onSave({ stamps, windowDays })}
        />
      </View>
    </Sheet>
  );
}
