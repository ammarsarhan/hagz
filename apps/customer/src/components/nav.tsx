import type { Icon } from "@tabler/icons-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { IconChevronLeft, IconX } from "./icons";

// The 40px grey circle from the Figma screens: back on the left, close on the right of a sheet.
export function RoundButton({
  icon: Glyph,
  label,
  onPress,
  mirrored = false,
}: {
  icon: Icon;
  label: string;
  onPress?: () => void;
  mirrored?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="size-10 items-center justify-center rounded-full bg-chip active:opacity-70"
    >
      <Glyph
        size={20}
        color={colors.ink}
        strokeWidth={2}
        style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </Pressable>
  );
}

// Points the way back: left in English, right in Arabic.
export function BackButton({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  return (
    <RoundButton
      icon={IconChevronLeft}
      label={t("components.nav.back")}
      onPress={onPress}
      mirrored={isRTL}
    />
  );
}

export function CloseButton({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  return <RoundButton icon={IconX} label={t("components.nav.close")} onPress={onPress} />;
}

// The row above the title: start and end slots only, no centre label.
export function NavBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <View className="-mx-1 mb-[22px] h-10 flex-row items-center justify-between">
      <View>{start}</View>
      <View>{end}</View>
    </View>
  );
}
