import type { components } from "@hagz/api";
import type { Icon } from "@tabler/icons-react-native";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, Switch, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { CodeInput } from "@/components/code-input";
import { useHud, useHudAnchor } from "@/components/hud";
import {
  IconCamera,
  IconChevronRight,
  IconExternalLink,
  IconLogout,
  IconPhoto,
  IconTrash,
} from "@/components/icons";
import { NoNameArt } from "@/components/no-name-art";
import { ResendCode } from "@/components/resend-code";
import { SettingsHeading, SettingsRow } from "@/components/settings-row";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { api, auth, reachable } from "@/lib/api";
import { fieldMessage, hudMessage, problem, retryAfter, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useFavoriteIds } from "@/lib/favorites";
import { isRTL, language } from "@/lib/language";
import { displayPhone, isolate, maskedPhone } from "@/lib/phone";
import { preparePhoto, putPhoto } from "@/lib/photos";
import { signOut } from "@/lib/session";
import { contactSupport, hasSupport } from "@/lib/support";
import { push } from "@/lib/navigation";

type Profile = components["schemas"]["CustomerProfile"];

const localDigits = (phone: string) => phone.replace(/^\+20/, "");
const direction = isRTL ? "rtl" : "ltr";
// The tab bar's row (components/tab-bar.tsx), which the HUD sits on.
const TAB_ROW = 49;

// The Account tab. Signed in (Figma C7, 154:2; the user, 2026-11-20): the staff app's account, with
// the player's photo (tap to change), name and number, then their favorites, security, the app,
// Sign out and the version. Rows for what isn't built yet (loyalty cards, notifications, the terms,
// deleting the account) come with their phases. A guest gets an "Uh oh!" with a way in. Read again each time the tab is opened, so it follows signing in elsewhere.
export default function AccountTab() {
  // Undefined while checking; null for a guest.
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const insets = useSafeAreaInsets();
  useHudAnchor(TAB_ROW + insets.bottom);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!(await auth.isSignedIn())) {
          if (active) setProfile(null);
          return;
        }
        const result = await send(api.GET("/v1/customers/me"));
        if (active) setProfile(result.ok ? result.data : null);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    // SafeAreaView is native and className doesn't reach it: its white is a style, or the window's
    // grey shows through.
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.white, direction }}>
      {profile === undefined ? null : profile ? (
        <SignedIn profile={profile} onProfile={setProfile} onSignedOut={() => setProfile(null)} />
      ) : (
        <Guest />
      )}
    </SafeAreaView>
  );
}

// A guest (Figma C7, 170:2, "No name on the shirt"; the user's pick, 2026-11-20): Search's "Uh oh!"
// empty state for the Account tab, the shirt with no name, then Create account (lime, a big moment)
// and Sign in. The tab's title over it, where Community and Bookings have theirs.
function Guest() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 pt-4">
      <Text accessibilityRole="header" className="px-6 text-title font-semibold tracking-[-0.4px]">
        {t("screens.account.title")}
      </Text>
      <GuestBody />
    </View>
  );
}

function GuestBody() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 pb-6">
      <NoNameArt />
      <Text accessibilityRole="header" className="mt-3 text-heading font-semibold">
        {t("screens.account.guestTitle")}
      </Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {t("screens.account.guest")}
      </Text>
      {/* Stacked, at the illustration screens' size (user, 2026-11-24): Create account, then Sign
          in, as wide as each other (the column takes the wider one's width). */}
      <View className="mt-6 gap-2.5">
        <Button
          label={t("common.actions.createAccount")}
          variant="moment"
          size="small"
          onPress={() => push("/sign-up")}
        />
        <Button
          label={t("common.actions.signIn")}
          variant="secondary"
          size="small"
          onPress={() => push("/sign-in")}
        />
      </View>
    </View>
  );
}

function SignedIn({
  profile,
  onProfile,
  onSignedOut,
}: {
  profile: Profile;
  onProfile: (profile: Profile) => void;
  onSignedOut: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const favorites = useFavoriteIds().size;
  const phone = localDigits(profile.phone);
  // The switch shows where it's going while the code is asked for.
  const [pending, setPending] = useState<boolean | null>(null);
  const [codeSheet, setCodeSheet] = useState<{ enable: boolean; resendAfter: number } | null>(null);
  const [codeSheetOpen, setCodeSheetOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  // What the photo sheet asked for, done once it has slid away (a picker can't open over it).
  const [photoChoice, setPhotoChoice] = useState<"library" | "camera" | "remove" | null>(null);

  const requestCode = async (enable: boolean) => {
    setPending(enable);
    const result = await send(api.POST("/v1/auth/customer/two-factor/codes"));
    let wait: number | undefined;
    if (result.ok) wait = result.data.resendAfter;
    // A code already on its way: the sheet opens on it, with the wait left.
    else if (problem(result.error)?.codeSent === true) wait = retryAfter(result.error);
    if (wait === undefined) {
      setPending(null);
      if (!result.ok) hud.show(hudMessage(result.error));
      return;
    }
    setCodeSheet({ enable, resendAfter: wait });
    setCodeSheetOpen(true);
  };

  // Asked for an upload, the photo sent straight to storage, then confirmed: only then is it theirs.
  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const photo = await preparePhoto(asset);
      const target = await send(
        api.POST("/v1/customers/me/avatar", {
          body: { contentType: "image/jpeg", size: photo.blob.size },
        }),
      );
      if (!target.ok) {
        hud.show(hudMessage(target.error));
        return;
      }
      // In development storage answers on the computer's localhost, which the phone reaches by
      // the API's address (lib/api.ts), as the staff app's photo uploads do.
      await putPhoto({ ...target.data, url: reachable(target.data.url) }, photo.blob);
      const confirmed = await send(api.POST("/v1/customers/me/avatar/confirm"));
      if (!confirmed.ok) {
        hud.show(hudMessage(confirmed.error));
        return;
      }
      onProfile(confirmed.data);
    } catch {
      hud.show(t("screens.account.photo.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const choosePhoto = async (choice: "library" | "camera" | "remove") => {
    if (choice === "remove") {
      setUploading(true);
      const result = await send(api.DELETE("/v1/customers/me/avatar"));
      setUploading(false);
      if (result.ok) onProfile({ ...profile, avatarUrl: null });
      else hud.show(hudMessage(result.error));
      return;
    }
    try {
      if (choice === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          hud.show(t("screens.account.photo.cameraBlocked"));
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      };
      const picked =
        choice === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (asset) await upload(asset);
    } catch {
      hud.show(t("screens.account.photo.failed"));
    }
  };

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
    <>
      <ScrollView
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      >
        {/* The room above the photo, as the staff app's account has it. */}
        <View className="mb-3 h-10" />
        <View className="items-center">
          <Avatar
            name={profile.name}
            url={profile.avatarUrl}
            busy={uploading}
            label={t("screens.account.photo.change")}
            onPress={() => setPhotoSheetOpen(true)}
          />
          <Text className="mt-3.5 text-[22px] leading-[1.27] font-semibold">{profile.name}</Text>
          <Text className="mt-1 text-body text-ink-2">{isolate(displayPhone(phone))}</Text>
        </View>

        <SettingsHeading first>{t("screens.account.yourHagz")}</SettingsHeading>
        <SettingsRow
          title={t("screens.account.favorites.title")}
          body={
            favorites > 0
              ? t("screens.account.favorites.count", { count: favorites })
              : t("screens.account.favorites.none")
          }
          trailing={chevron}
          onPress={() => push("/favorites")}
        />

        <SettingsHeading>{t("screens.account.security")}</SettingsHeading>
        <SettingsRow
          title={t("screens.account.twoFactor.title")}
          body={
            profile.twoFactorEnabled
              ? t("screens.account.twoFactor.on")
              : t("screens.account.twoFactor.off")
          }
          trailing={
            <Switch
              accessibilityLabel={t("screens.account.twoFactor.title")}
              value={pending ?? profile.twoFactorEnabled}
              disabled={pending !== null}
              onValueChange={(enable) => void requestCode(enable)}
              trackColor={{ true: colors.ink }}
            />
          }
        />
        <SettingsRow
          title={t("screens.account.password.title")}
          body={t("screens.account.password.body")}
          trailing={chevron}
          onPress={() => push({ pathname: "/forgot-password", params: { phone } })}
        />

        <SettingsHeading>{t("screens.account.app")}</SettingsHeading>
        <SettingsRow
          title={t("screens.account.language.title")}
          body={t("screens.account.language.body", {
            language: t(`screens.account.language.${language}`),
          })}
          trailing={external}
          onPress={() => void Linking.openSettings()}
        />
        {hasSupport ? (
          <SettingsRow
            title={t("common.actions.contactSupport")}
            body={t("screens.account.support")}
            trailing={external}
            onPress={contactSupport}
          />
        ) : null}

        <View className="mt-2">
          <SettingsRow
            title={t("common.actions.signOut")}
            trailing={<IconLogout size={18} color={colors.unit} strokeWidth={2} />}
            onPress={() => setSignOutOpen(true)}
            divider={false}
          />
        </View>
        <Text className="mt-3.5 text-center text-caption text-ink-3">
          {t("screens.account.version", { version: Constants.expoConfig?.version ?? "" })}
        </Text>
      </ScrollView>

      <PhotoSheet
        visible={photoSheetOpen}
        hasPhoto={profile.avatarUrl !== null}
        onChoose={(choice) => {
          setPhotoChoice(choice);
          setPhotoSheetOpen(false);
        }}
        onClose={() => setPhotoSheetOpen(false)}
        onHidden={() => {
          const choice = photoChoice;
          setPhotoChoice(null);
          if (choice) void choosePhoto(choice);
        }}
      />

      {codeSheet ? (
        <TwoFactorSheet
          enable={codeSheet.enable}
          phone={phone}
          resendAfter={codeSheet.resendAfter}
          visible={codeSheetOpen}
          onClose={() => setCodeSheetOpen(false)}
          onHidden={() => {
            setCodeSheet(null);
            setPending(null);
          }}
          onChanged={(enabled) => {
            onProfile({ ...profile, twoFactorEnabled: enabled });
            setCodeSheetOpen(false);
          }}
        />
      ) : null}

      <SignOutSheet
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onSignedOut={onSignedOut}
      />
    </>
  );
}

// Changing the photo: from the library or the camera, or taking it off.
function PhotoSheet({
  visible,
  hasPhoto,
  onChoose,
  onClose,
  onHidden,
}: {
  visible: boolean;
  hasPhoto: boolean;
  onChoose: (choice: "library" | "camera" | "remove") => void;
  onClose: () => void;
  onHidden: () => void;
}) {
  const { t } = useTranslation();
  const choices: { key: "library" | "camera" | "remove"; icon: Icon; label: string }[] = [
    { key: "library", icon: IconPhoto, label: t("screens.account.photo.library") },
    { key: "camera", icon: IconCamera, label: t("screens.account.photo.camera") },
    ...(hasPhoto
      ? [{ key: "remove" as const, icon: IconTrash, label: t("screens.account.photo.remove") }]
      : []),
  ];
  return (
    <Sheet visible={visible} onClose={onClose} onHidden={onHidden} closeButton={false}>
      {/* A small title over the choices, so the sheet says what it's for (user, 2026-11-24). */}
      <Text accessibilityRole="header" className="mb-1 text-body font-semibold">
        {t("screens.account.photo.title")}
      </Text>
      <View>
        {choices.map(({ key, icon: Glyph, label }, index) => (
          <SettingsRow
            key={key}
            title={label}
            trailing={<Glyph size={20} color={colors.ink} strokeWidth={1.75} />}
            onPress={() => onChoose(key)}
            divider={index < choices.length - 1}
          />
        ))}
      </View>
    </Sheet>
  );
}

// The WhatsApp code that turns two-factor on or off, as the staff app asks for it.
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
  const [sent, setSent] = useState({ count: 0, resendAfter: firstResendAfter });

  const save = async () => {
    setSaving(true);
    const result = await send(
      api.PUT("/v1/auth/customer/two-factor", { body: { enabled: enable, code } }),
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
    const result = await send(api.POST("/v1/auth/customer/two-factor/codes"));
    setResending(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    setCode("");
    setError(undefined);
    setLocked(false);
    setSent((previous) => ({ count: previous.count + 1, resendAfter: result.data.resendAfter }));
  };

  return (
    <Sheet visible={visible} onClose={onClose} onHidden={onHidden}>
      <Text className="mb-1.5 text-heading font-semibold">
        {enable
          ? t("screens.account.twoFactor.turnOnTitle")
          : t("screens.account.twoFactor.turnOffTitle")}
      </Text>
      <Text className="mb-[22px] text-subtitle text-ink-2">
        {t("screens.account.twoFactor.subtitle", { phone: isolate(maskedPhone(phone)) })}
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
function SignOutSheet({
  visible,
  onClose,
  onSignedOut,
}: {
  visible: boolean;
  onClose: () => void;
  onSignedOut: () => void;
}) {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text className="mb-1.5 text-heading font-semibold">
        {t("screens.account.signOut.title")}
      </Text>
      <Text className="mb-[26px] text-subtitle text-ink-2">
        {t("screens.account.signOut.body")}
      </Text>
      <View className="gap-2.5">
        <Button
          label={t("common.actions.signOut")}
          loading={signingOut}
          onPress={() => {
            setSigningOut(true);
            void signOut().then(onSignedOut);
          }}
        />
        <Button label={t("screens.account.signOut.cancel")} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
