import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, View } from "react-native";
import { colors } from "@/lib/colors";
import { Button } from "./button";
import { FieldBox, inputClass } from "./field";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Asking Hagz to cover the area a venue is in, when none it covers is in reach of the pin (not drawn
// in Figma; the deposit sheet's shape). Only the name is asked for: the pin goes with the venue it's
// created with, so Hagz has both when reviewing it (docs/onboarding.md). The name's limits are the
// API's (RequestedArea in @hagz/contracts).
const MIN = 2;
const MAX = 80;

export function RequestAreaSheet({
  visible,
  requested,
  onClose,
  onRequest,
}: {
  visible: boolean;
  // The name asked for already, to change.
  requested: string | null;
  onClose: () => void;
  onRequest: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(requested ?? "");
  const [focused, setFocused] = useState(false);

  // Opens on what was asked for last, or empty.
  useEffect(() => {
    if (visible) setName(requested ?? "");
  }, [visible, requested]);

  const tidied = name.trim().replace(/\s+/g, " ");
  const valid = tidied.length >= MIN;

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.createVenue.place.requestTitle")}
      </Text>
      <Text className="mb-4 mt-1.5 text-body text-ink-2">
        {t("screens.createVenue.place.requestBody")}
      </Text>
      <FieldBox focused={focused} error={false}>
        <TextInput
          accessibilityLabel={t("screens.createVenue.place.requestTitle")}
          className={inputClass}
          value={name}
          onChangeText={setName}
          maxLength={MAX}
          placeholder={t("screens.createVenue.place.requestPlaceholder")}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          autoFocus
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => valid && onRequest(tidied)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </FieldBox>
      <View className="mt-6">
        <Button
          label={t("screens.createVenue.place.requestDone")}
          disabled={!valid || tidied === requested}
          onPress={() => onRequest(tidied)}
        />
      </View>
    </Sheet>
  );
}
