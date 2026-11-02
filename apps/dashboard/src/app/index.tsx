import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/button";
import { CodeInput } from "@/components/code-input";
import { Field } from "@/components/field";
import { IconEye, IconEyeOff } from "@/components/icons";
import { useHud } from "@/components/hud";
import { BackButton, CloseButton, NavBar } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";
import { t } from "@/lib/i18n";

// Component sheet (temporary home screen): the shared pieces in their states, live, in the
// device's language. Tap the fields to see focus; the second of each pair shows an error. Create
// account shows the loading spinner for two seconds.
export default function Home() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(false);
  const hud = useHud();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="pt-2">
          <NavBar
            start={<BackButton label={t("back")} />}
            end={<CloseButton label={t("close")} />}
          />
          <Title subtitle={t("componentsSubtitle")}>{t("componentsTitle")}</Title>

          <PhoneField label={t("mobileNumber")} value={phone} onChangeText={setPhone} />
          <PhoneField value="1001234567" onChangeText={() => undefined} error={t("phoneTaken")} />

          <Field
            label={t("fullName")}
            placeholder={t("fullNamePlaceholder")}
            value={name}
            onChangeText={setName}
            textContentType="name"
            autoComplete="name"
          />
          <Field
            label={t("password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!shown}
            textContentType="newPassword"
            error={password.length > 0 && password.length < 8 ? t("passwordTooShort") : undefined}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={shown ? t("hidePassword") : t("showPassword")}
                onPress={() => setShown(!shown)}
                hitSlop={8}
              >
                {shown ? (
                  <IconEye size={20} color={colors.unit} strokeWidth={2} />
                ) : (
                  <IconEyeOff size={20} color={colors.unit} strokeWidth={2} />
                )}
              </Pressable>
            }
          />

          <CodeInput value={code} onChangeText={setCode} />
          <CodeInput value="482914" onChangeText={() => undefined} error={t("codeWrong")} />
          <CodeInput value="" onChangeText={() => undefined} disabled error={t("tooManyTries")} />

          <View className="mt-4 gap-2.5 pb-10">
            <Button
              label={t("createAccount")}
              loading={loading}
              onPress={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 2000);
              }}
            />
            <Button
              label={t("showHud")}
              variant="secondary"
              onPress={() => hud.show(t("couldntSendCode"))}
            />
            <Button label={t("openSheet")} variant="secondary" onPress={() => setSheet(true)} />
            <Button label={t("createVenue")} variant="secondary" />
            <Button label={t("haveCode")} variant="ghost" />
            <Button label={t("continue")} disabled />
          </View>
        </View>
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)} closeLabel={t("close")}>
        <Text className="mb-1.5 text-heading font-semibold">{t("invitationCodeTitle")}</Text>
        <Text className="mb-[22px] text-subtitle text-ink-2">{t("invitationCodeSubtitle")}</Text>
        <CodeInput kind="code" value={joinCode} onChangeText={setJoinCode} autoFocus />
        <View className="mt-1">
          <Button label={t("continue")} disabled={joinCode.length < 6} />
        </View>
      </Sheet>
    </Screen>
  );
}
