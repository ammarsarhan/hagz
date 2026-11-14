import type { Icon } from "@tabler/icons-react-native";
import type { ReactNode } from "react";
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
export function BackButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return <RoundButton icon={IconChevronLeft} label={label} onPress={onPress} mirrored={isRTL} />;
}

export function CloseButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return <RoundButton icon={IconX} label={label} onPress={onPress} />;
}

// The row above the title. No centre label (decided 2026-11-01): start and end slots only. Flush
// drops the gap under it, for a body that carries the gap itself (FadingScroll).
export function NavBar({
  start,
  end,
  flush = false,
}: {
  start?: ReactNode;
  end?: ReactNode;
  flush?: boolean;
}) {
  return (
    <View
      className={`-mx-1 flex-row items-center justify-between ${flush ? "h-14 py-2" : "mb-[22px] h-10"}`}
    >
      <View>{start}</View>
      <View>{end}</View>
    </View>
  );
}
