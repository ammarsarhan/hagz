import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { noticeLabel, NOTICE_CHOICES, type MinimumNotice } from "@/lib/settings";
import { RadioMark } from "./choices";
import { Sheet } from "./sheet";
import { Text } from "./text";

// When booking closes: one of a fixed list (NOTICE_CHOICES). Not drawn in Figma; a plain list of
// the choices, like the cancellation policies, and choosing one saves it and closes the sheet.
export function NoticeSheet({
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
