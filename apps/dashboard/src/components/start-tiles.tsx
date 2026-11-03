import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { colors } from "@/lib/colors";
import { IconPlus } from "./icons";
import { Text } from "./text";

// The pitch markings' soft blue on the blue tint.
const PITCH_LINE = "#c9d3fb";
// The graphics take the top of each tile; the words sit under them.
const ART_HEIGHT = 92;

// First run's "More ways to start", as approved in Figma ("D2 · First run, More ways to start
// options", idea 1): two tiles side by side. Create your venue kicks off from a pitch's centre
// circle; Have a code? is a ticket showing the code's six slots. The tiles grow together when a
// translation needs more lines.
export function StartTiles({
  onCreateVenue,
  onHaveCode,
}: {
  onCreateVenue: () => void;
  onHaveCode: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-2.5">
      <Tile
        className="bg-blue-tint"
        title={t("screens.firstRun.createVenueTitle")}
        body={t("screens.firstRun.createVenueTileBody")}
        onPress={onCreateVenue}
        art={
          <>
            <Svg width="100%" height={ART_HEIGHT} style={{ position: "absolute" }}>
              <Line x1="0" y1="52" x2="100%" y2="52" stroke={PITCH_LINE} strokeWidth={1.5} />
              <Circle cx="50%" cy="52" r="34" fill="none" stroke={PITCH_LINE} strokeWidth={1.5} />
              {/* The goal area, running off the tile's top edge. */}
              <Rect
                x="9%"
                y="-2"
                width="82%"
                height="24"
                fill="none"
                stroke={PITCH_LINE}
                strokeWidth={1.5}
              />
            </Svg>
            <View className="absolute left-0 right-0 top-[34px] items-center">
              <View className="size-9 items-center justify-center rounded-full bg-primary">
                <IconPlus size={20} color={colors.onPrimary} strokeWidth={2} />
              </View>
            </View>
          </>
        }
      />
      <Tile
        className="bg-field"
        title={t("screens.firstRun.haveCode")}
        body={t("screens.firstRun.haveCodeBody")}
        onPress={onHaveCode}
        art={
          <>
            <View className="absolute left-4 right-4 top-[37px] flex-row gap-[5px]">
              {[0, 1, 2, 3, 4, 5].map((slot) => (
                <View key={slot} className="h-[30px] flex-1 rounded-[7px] bg-white">
                  <View className="absolute bottom-2 left-[7px] right-[7px] h-0.5 rounded-full bg-grab" />
                </View>
              ))}
            </View>
            {/* The perforation, with a notch cut from each side in the page's white. */}
            <View className="absolute left-[18px] right-[18px] top-[86px] border-t-2 border-dashed border-grab" />
            <View className="absolute -left-2.5 top-[77px] size-5 rounded-full bg-white" />
            <View className="absolute -right-2.5 top-[77px] size-5 rounded-full bg-white" />
          </>
        }
      />
    </View>
  );
}

function Tile({
  className,
  title,
  body,
  art,
  onPress,
}: {
  className: string;
  title: string;
  body: string;
  art: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      onPress={onPress}
      className={`flex-1 overflow-hidden rounded-[18px] active:opacity-70 ${className}`}
    >
      <View style={{ height: ART_HEIGHT }}>{art}</View>
      <View className="px-4 pb-4 pt-3">
        <Text className="text-[15px] font-semibold leading-[1.33]">{title}</Text>
        <Text className="mt-0.5 text-caption text-ink-2">{body}</Text>
      </View>
    </Pressable>
  );
}
