import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, TextInput, View } from "react-native";
import { Button } from "@/components/button";
import { RadioMark, SelectionBox, useSelection } from "@/components/choices";
import { Collapse } from "@/components/collapse";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { FieldBox, FieldLabel, inputClass } from "@/components/field";
import { IconChevronRight } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { queries } from "@/lib/queries";
import {
  DEFAULT_LOYALTY,
  NOTICE_CHOICES,
  PAYMENT_MODES,
  noticeLabel,
  paymentLabel,
  type MinimumNotice,
  type PaymentMode,
} from "@/lib/settings";
import { useSaveSettings, type VenueDetail } from "@/lib/venue-edit";

// Setup item "Payments and cancellations" (Figma "Payments · A Plain list", 326:2): a plain list
// under headings, no Save button. Each change is saved as it's made; the two choices with more to
// them open sheets ("How players pay", 318:2, and when booking closes), and the cancellation policy
// has screens of its own (settings/cancellation).
export default function SetupSettings() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const venue = useQuery(queries.venue(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  return <SettingsList venueId={venueId} venue={venue.data} />;
}

function SettingsList({ venueId, venue }: { venueId: string; venue: VenueDetail }) {
  const { t } = useTranslation();
  const compact = useCompactTitle();
  const save = useSaveSettings(venueId);
  const { settings } = venue;
  const [choosingNotice, setChoosingNotice] = useState(false);
  const [paying, setPaying] = useState(false);
  // A fresh "How players pay" sheet each time, starting from what's saved.
  const [paymentKey, setPaymentKey] = useState(0);
  const loyalty = settings.loyalty ?? DEFAULT_LOYALTY;
  const policy = settings.cancellationPolicy;

  return (
    <Screen>
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={t("screens.setup.items.SETTINGS.title")}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          subtitle={t("screens.setup.settings.subtitle")}
          onTitleLayout={compact.onTitleLayout}
        >
          {t("screens.setup.items.SETTINGS.title")}
        </Title>

        <Heading first>{t("screens.setup.settings.bookings")}</Heading>
        <Row
          title={t("screens.setup.settings.autoConfirm")}
          body={t("screens.setup.settings.autoConfirmBody")}
          trailing={
            <Switch
              accessibilityLabel={t("screens.setup.settings.autoConfirm")}
              value={settings.autoConfirm}
              onValueChange={(autoConfirm) => void save({ autoConfirm })}
              trackColor={{ true: colors.primary, false: colors.border }}
              ios_backgroundColor={colors.border}
            />
          }
        />
        <Row
          title={t("screens.setup.settings.closes")}
          trailing={<Value>{noticeLabel(t, settings.minimumNotice)}</Value>}
          onPress={() => setChoosingNotice(true)}
        />

        <Heading>{t("screens.setup.settings.payments")}</Heading>
        <Row
          title={t("screens.setup.settings.howPlayersPay")}
          trailing={<Value>{paymentLabel(t, settings.paymentMode, settings.depositPercent)}</Value>}
          onPress={() => {
            setPaymentKey((key) => key + 1);
            setPaying(true);
          }}
        />

        <Heading>{t("screens.setup.settings.cancellations")}</Heading>
        <Row
          title={t("screens.setup.settings.policy")}
          // Until one is chosen, the row says so: it's the one setting review needs.
          body={policy ? undefined : t("screens.setup.settings.policyRequired")}
          trailing={
            <Value action={!policy}>
              {policy
                ? t(`screens.setup.settings.cancellation.policies.${policy}.title`)
                : t("screens.setup.settings.choosePolicy")}
            </Value>
          }
          onPress={() => router.push(`/setup/${venueId}/settings/cancellation`)}
        />

        <Heading>{t("screens.setup.settings.loyalty")}</Heading>
        <Row
          title={t("screens.setup.settings.rewardRegulars")}
          body={t("screens.setup.settings.rewardBody", {
            count: loyalty.stamps,
            days: loyalty.windowDays,
            ordinal: true,
          })}
          trailing={
            <Switch
              accessibilityLabel={t("screens.setup.settings.rewardRegulars")}
              value={settings.loyalty !== null}
              onValueChange={(on) => void save({ loyalty: on ? DEFAULT_LOYALTY : null })}
              trackColor={{ true: colors.primary, false: colors.border }}
              ios_backgroundColor={colors.border}
            />
          }
        />
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
        key={paymentKey}
        visible={paying}
        mode={settings.paymentMode}
        depositPercent={settings.depositPercent}
        onClose={() => setPaying(false)}
        onSave={(change) => {
          setPaying(false);
          void save(change);
        }}
      />
    </Screen>
  );
}

// A group's heading: 18 Semi Bold, the account screen's group headings (SettingsHeading). Smaller
// than Figma's 22 (user, 2026-11-15), so the groups don't compete with the page title.
function Heading({ children, first = false }: { children: string; first?: boolean }) {
  return (
    <Text
      accessibilityRole="header"
      className={`pb-0.5 text-[18px] font-semibold leading-[1.33] ${first ? "" : "pt-[22px]"}`}
    >
      {children}
    </Text>
  );
}

// One setting over a hairline: a 16 Medium title, an optional grey line under it, and its switch
// or value at the end. A row with a value opens its choices.
function Row({
  title,
  body,
  trailing,
  onPress,
}: {
  title: string;
  body?: string;
  trailing: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border py-[15px] active:opacity-60"
    >
      <View className="flex-1">
        <Text className="text-subtitle font-medium">{title}</Text>
        {body ? (
          <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">{body}</Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

// What a row is set to, in grey, with a chevron. Something still to do is an action instead: ink,
// Medium, underlined ("Choose a policy"), as the staff app shows what needs doing without colour.
function Value({ children, action = false }: { children: string; action?: boolean }) {
  return (
    <View className="flex-row items-center gap-1">
      <Text
        className={`text-body ${action ? "font-medium underline" : "text-ink-2"}`}
        numberOfLines={1}
      >
        {children}
      </Text>
      <IconChevronRight
        size={18}
        color={colors.ink3}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </View>
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
  const [percent, setPercent] = useState(depositPercent === null ? "" : String(depositPercent));
  const [focused, setFocused] = useState(false);
  const deposit = Number(percent);
  const depositValid = percent !== "" && deposit >= 1 && deposit <= 99;
  const valid = mode !== "DEPOSIT" || depositValid;
  const changed = mode !== savedMode || (mode === "DEPOSIT" && deposit !== depositPercent);

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
          <View key={option}>
            <PaymentCard mode={option} selected={option === mode} onPress={() => setMode(option)} />
            {option === "DEPOSIT" ? (
              <Collapse open={mode === "DEPOSIT"}>
                <View className="px-1 pt-3">
                  <FieldLabel required>{t("screens.setup.settings.payment.deposit")}</FieldLabel>
                  <FieldBox focused={focused} error={false} ltr>
                    <TextInput
                      accessibilityLabel={t("screens.setup.settings.payment.deposit")}
                      className={inputClass}
                      value={percent}
                      onChangeText={(text) => setPercent(text.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      placeholder="20"
                      placeholderTextColor={colors.ink3}
                      selectionColor={colors.primary}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      style={{ textAlign: "left", writingDirection: "ltr" }}
                    />
                    <Text className="text-body text-ink-2">%</Text>
                  </FieldBox>
                  <Text className="mt-1.5 text-label leading-[1.43] text-ink-2">
                    {percent !== "" && !depositValid
                      ? t("screens.setup.settings.payment.depositRange")
                      : t("screens.setup.settings.payment.depositHint")}
                  </Text>
                </View>
              </Collapse>
            ) : null}
          </View>
        ))}
      </View>
      <Text className="px-1 pb-[18px] pt-3.5 text-caption text-ink-2">
        {t("screens.setup.settings.payment.payoutNote")}
      </Text>
      <Button
        label={t("screens.setup.settings.payment.done")}
        disabled={!valid || !changed}
        onPress={() =>
          onSave({ paymentMode: mode, depositPercent: mode === "DEPOSIT" ? deposit : null })
        }
      />
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
