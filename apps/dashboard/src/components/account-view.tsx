import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, ScrollView, Switch, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { CodeInput } from "@/components/code-input";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconExternalLink, IconLogout } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { ResendCode } from "@/components/resend-code";
import { Screen } from "@/components/screen";
import { SettingsHeading, SettingsRow } from "@/components/settings-row";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, retryAfter, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL, language } from "@/lib/language";
import { displayPhone, isolate } from "@/lib/phone";
import { queries } from "@/lib/queries";
import { signOut } from "@/lib/session";
import { contactSupport, hasSupport } from "@/lib/support";

const localDigits = (phone: string) => phone.replace(/^\+20/, "");

// The signed-in staff member's account (Figma "D4 · Account, round 2"): who they are, centred; then
// Security (two-factor, password) and App (language, support) as big headings over hairline rows;
// then sign out, confirmed in a sheet. Opened from first run's avatar, with a way back, and as a
// venue's Account tab, without one.
export function AccountView({ tabbed = false }: { tabbed?: boolean }) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  // From the cache when first run already fetched it: opening the page again doesn't ask the server.
  const { data: me, error, isError, refetch } = useQuery(queries.me);
  // For "Join or create a venue" on the tab: how many invitations are waiting (cached with first run's).
  const waiting = useQuery({ ...queries.invitations, enabled: tabbed }).data?.length ?? 0;
  // Turning two-factor on or off: a code is sent first, then the sheet takes it. The switch shows
  // the tap (`pending`) while that's under way, and goes back if the code isn't sent or the sheet
  // closes without one accepted; the line under the title keeps saying what's saved.
  const [pending, setPending] = useState<boolean | null>(null);
  const [codeSheet, setCodeSheet] = useState<{ enable: boolean; resendAfter: number } | null>(null);
  const [codeSheetOpen, setCodeSheetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    if (isError) hud.show(hudMessage(error));
  }, [isError, error, hud]);

  const requestCode = async (enable: boolean) => {
    setPending(enable);
    const result = await send(api.POST("/v1/auth/staff/two-factor/codes"));
    // Rate limited with `codeSent`: the last code (the sheet was opened, then closed) still works, so
    // open the sheet on it, counting down to the next. Without one there's nothing to enter, so the
    // wait is only reported.
    let wait: number | undefined;
    if (result.ok) wait = result.data.resendAfter;
    else if (problem(result.error)?.codeSent === true) wait = retryAfter(result.error);
    if (wait === undefined) {
      setPending(null);
      if (!result.ok) hud.show(hudMessage(result.error));
      return;
    }
    setCodeSheet({ enable, resendAfter: wait });
    setCodeSheetOpen(true);
  };

  const back = tabbed ? (
    // In place of the back button's row, so the page starts at the same height.
    <View className="mb-[22px] h-10" />
  ) : (
    <NavBar
      start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
    />
  );

  if (!me) {
    return (
      <Screen
        tabbed={tabbed}
        footer={
          isError ? (
            <Button label={t("screens.firstRun.retry")} onPress={() => void refetch()} />
          ) : undefined
        }
      >
        {back}
        {isError ? null : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.ink3} />
          </View>
        )}
      </Screen>
    );
  }

  const phone = localDigits(me.phone);
  const chevron = (
    <IconChevronRight
      size={18}
      color={colors.unit}
      strokeWidth={2}
      style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
  const external = <IconExternalLink size={18} color={colors.unit} strokeWidth={2} />;

  return (
    <Screen tabbed={tabbed}>
      {/* The whole page scrolls, back button included. The scroll view reaches the screen edges and
          puts the gutters back inside, so the round button's 4px overhang isn't clipped. */}
      <ScrollView
        // Scrolls (and bounces) even when everything fits, like the system's settings pages.
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      >
        {back}
        <View className="items-center">
          <Avatar name={me.name} size="large" />
          <Text className="mt-3.5 text-[22px] font-semibold leading-[1.27]">{me.name}</Text>
          <Text className="mt-1 text-body text-ink-2">{isolate(displayPhone(phone))}</Text>
        </View>

        <SettingsHeading first>{t("screens.account.security")}</SettingsHeading>
        <SettingsRow
          title={t("screens.account.twoFactor.title")}
          body={
            me.twoFactorEnabled
              ? t("screens.account.twoFactor.on")
              : t("screens.account.twoFactor.off")
          }
          trailing={
            <Switch
              accessibilityLabel={t("screens.account.twoFactor.title")}
              value={pending ?? me.twoFactorEnabled}
              disabled={pending !== null}
              onValueChange={(enable) => void requestCode(enable)}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        <SettingsRow
          title={t("screens.account.password.title")}
          body={t("screens.account.password.body")}
          trailing={chevron}
          onPress={() => router.push({ pathname: "/forgot-password", params: { phone } })}
        />

        <SettingsHeading>{t("screens.account.app")}</SettingsHeading>
        <SettingsRow
          title={t("screens.account.language.title")}
          body={t("screens.account.language.body", {
            language: t(`screens.account.language.${language}`),
          })}
          trailing={external}
          // Each app has its own language in the phone's settings; the app follows it.
          onPress={() => void Linking.openSettings()}
        />
        {hasSupport ? (
          <SettingsRow
            title={t("common.actions.contactSupport")}
            body={t("screens.account.support.body")}
            trailing={external}
            onPress={contactSupport}
          />
        ) : null}
        {tabbed ? (
          <>
            {/* Already on a venue's team: the way onto another, as first run offers it. */}
            <SettingsHeading>{t("screens.account.venues")}</SettingsHeading>
            <SettingsRow
              title={t("screens.account.join.title")}
              body={
                waiting > 0
                  ? t("screens.account.join.waiting", { count: waiting })
                  : t("screens.account.join.body")
              }
              trailing={chevron}
              onPress={() => router.push("/join")}
            />
          </>
        ) : null}
        <View className="mt-2">
          <SettingsRow
            title={t("common.actions.signOut")}
            trailing={<IconLogout size={18} color={colors.unit} strokeWidth={2} />}
            onPress={() => setSignOutOpen(true)}
            divider={false}
          />
        </View>

        <Text className="mt-3.5 text-center text-caption text-unit">
          {t("screens.account.version", { version: Constants.expoConfig?.version ?? "" })}
        </Text>
      </ScrollView>

      {codeSheet ? (
        <TwoFactorSheet
          enable={codeSheet.enable}
          phone={phone}
          resendAfter={codeSheet.resendAfter}
          visible={codeSheetOpen}
          onClose={() => setCodeSheetOpen(false)}
          onHidden={() => {
            // Accepted or not, the saved setting is what to show now.
            setCodeSheet(null);
            setPending(null);
          }}
          onChanged={(enabled) => {
            // The answer says what it is now, so the cached account is updated rather than fetched.
            queryClient.setQueryData(queries.me.queryKey, (current) =>
              current ? { ...current, twoFactorEnabled: enabled } : current,
            );
            setCodeSheetOpen(false);
          }}
        />
      ) : null}

      <SignOutSheet visible={signOutOpen} onClose={() => setSignOutOpen(false)} />
    </Screen>
  );
}

// The WhatsApp code that confirms turning two-factor on or off.
function TwoFactorSheet({
  enable,
  phone,
  resendAfter: firstResendAfter,
  visible,
  onClose,
  onHidden,
  onChanged,
}: {
  enable: boolean;
  phone: string;
  resendAfter: number;
  visible: boolean;
  onClose: () => void;
  onHidden: () => void;
  onChanged: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  // Each send restarts the countdown (ResendCode's key).
  const [sent, setSent] = useState({ count: 0, resendAfter: firstResendAfter });
  // Only the last four digits, as in sign in's code sheet: "+20 100 ••• 4567".
  const masked = `${displayPhone(phone).slice(0, 7)} ••• ${phone.slice(-4)}`;

  const save = async () => {
    setSaving(true);
    const result = await send(
      api.PUT("/v1/auth/staff/two-factor", { body: { enabled: enable, code } }),
    );
    setSaving(false);
    if (result.ok) {
      onChanged(result.data.enabled);
      return;
    }
    const failure = problem(result.error)?.code;
    if (failure === "INVALID_CODE" || failure === "CODE_EXPIRED") {
      setError(fieldMessage(result.error));
    } else if (failure === "RATE_LIMITED") {
      setLocked(true);
      setError(fieldMessage(result.error));
    } else {
      onClose();
      hud.show(hudMessage(result.error));
    }
  };

  const resend = async () => {
    setResending(true);
    const result = await send(api.POST("/v1/auth/staff/two-factor/codes"));
    setResending(false);
    if (!result.ok) {
      // Too soon (or too many for now): count down again instead of reporting a problem.
      const wait = retryAfter(result.error);
      if (wait !== undefined) setSent({ count: sent.count + 1, resendAfter: wait });
      else hud.show(hudMessage(result.error));
      return;
    }
    setCode("");
    setError(undefined);
    setLocked(false);
    setSent({ count: sent.count + 1, resendAfter: result.data.resendAfter });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text className="mb-1.5 text-heading font-semibold">
        {enable
          ? t("screens.account.twoFactor.turnOnTitle")
          : t("screens.account.twoFactor.turnOffTitle")}
      </Text>
      <Text className="mb-[22px] text-subtitle text-ink-2">
        {t("screens.account.twoFactor.subtitle", { phone: isolate(masked) })}
      </Text>
      <CodeInput
        value={code}
        onChangeText={(next) => {
          setCode(next);
          setError(undefined);
        }}
        error={error}
        disabled={locked}
      />
      <View className="mt-1">
        <ResendCode
          key={sent.count}
          resendAfter={sent.resendAfter}
          onResend={() => void resend()}
          sending={resending}
        />
      </View>
      <View className="mt-[22px]">
        <Button
          label={
            enable ? t("screens.account.twoFactor.turnOn") : t("screens.account.twoFactor.turnOff")
          }
          disabled={code.length < 6 || Boolean(error) || locked}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </Sheet>
  );
}

// Asked once more, so a stray tap doesn't sign them out.
function SignOutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);

  const confirm = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text className="mb-1.5 text-heading font-semibold">
        {t("screens.account.signOut.title")}
      </Text>
      <Text className="mb-[26px] text-subtitle text-ink-2">
        {t("screens.account.signOut.body")}
      </Text>
      <View className="gap-2.5">
        <Button
          label={t("common.actions.signOut")}
          variant="ink"
          loading={signingOut}
          onPress={() => void confirm()}
        />
        <Button label={t("screens.account.signOut.cancel")} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
