import type { components } from "@hagz/api";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { api, auth } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL, language } from "@/lib/language";
import { resetTo } from "@/lib/navigation";
import { displayPhone, isolate } from "@/lib/phone";
import { contactSupport, hasSupport } from "@/lib/support";

type Staff = components["schemas"]["Staff"];

const localDigits = (phone: string) => phone.replace(/^\+20/, "");

// The signed-in staff member's account, from the avatar (Figma "D4 · Account, round 2"): who they
// are, centred; then Security (two-factor, password) and App (language, support) as big headings over
// hairline rows; then sign out, confirmed in a sheet.
export default function Account() {
  const { t } = useTranslation();
  const hud = useHud();
  const [me, setMe] = useState<Staff | null>(null);
  const [failed, setFailed] = useState(false);
  // Turning two-factor on or off: a code is sent first, then the sheet takes it. The switch only
  // moves once the code is accepted.
  const [requesting, setRequesting] = useState(false);
  const [codeSheet, setCodeSheet] = useState<{ enable: boolean; resendAfter: number } | null>(null);
  const [codeSheetOpen, setCodeSheetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await send(api.GET("/v1/staff/me"));
    if (result.ok) setMe(result.data);
    else {
      hud.show(hudMessage(result.error));
      setFailed(true);
    }
  }, [hud]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestCode = async (enable: boolean) => {
    setRequesting(true);
    const result = await send(api.POST("/v1/auth/staff/two-factor/codes"));
    setRequesting(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    setCodeSheet({ enable, resendAfter: result.data.resendAfter });
    setCodeSheetOpen(true);
  };

  const back = (
    <NavBar
      start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
    />
  );

  if (!me) {
    return (
      <Screen
        footer={
          failed ? (
            <Button label={t("screens.firstRun.retry")} onPress={() => void load()} />
          ) : undefined
        }
      >
        {back}
        {failed ? null : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.ink3} />
          </View>
        )}
      </Screen>
    );
  }

  const phone = localDigits(me.phone);
  const external = <IconExternalLink size={18} color={colors.unit} strokeWidth={2} />;

  return (
    <Screen>
      {back}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
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
              value={me.twoFactorEnabled}
              disabled={requesting}
              onValueChange={(enable) => void requestCode(enable)}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        <SettingsRow
          title={t("screens.account.password.title")}
          body={t("screens.account.password.body")}
          trailing={
            <IconChevronRight
              size={18}
              color={colors.unit}
              strokeWidth={2}
              style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          }
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
        <View className="mt-2">
          <SettingsRow
            title={t("common.actions.signOut")}
            trailing={<IconLogout size={18} color={colors.red} strokeWidth={2} />}
            onPress={() => setSignOutOpen(true)}
            divider={false}
            destructive
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
          onHidden={() => setCodeSheet(null)}
          onChanged={(enabled) => {
            setMe({ ...me, twoFactorEnabled: enabled });
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
      hud.show(hudMessage(result.error));
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

  const signOut = async () => {
    setSigningOut(true);
    await auth.signOut();
    resetTo("/");
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
          variant="destructive"
          loading={signingOut}
          onPress={() => void signOut()}
        />
        <Button label={t("screens.account.signOut.cancel")} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
