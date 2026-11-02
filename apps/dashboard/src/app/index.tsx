import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { IconEye, IconEyeOff } from "@/components/icons";
import { BackButton, CloseButton, NavBar } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";
import { t } from "@/lib/i18n";

// Component sheet (temporary home screen): the shared pieces in their states, live, in the
// device's language. Tap the fields to see focus; the second of each pair shows an error.
export default function Home() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);

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

          <View className="mt-4 gap-2.5 pb-10">
            <Button label={t("createAccount")} />
            <Button label={t("createVenue")} variant="secondary" />
            <Button label={t("haveCode")} variant="ghost" />
            <Button label={t("continue")} disabled />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
