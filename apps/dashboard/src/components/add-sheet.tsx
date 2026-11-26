import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/lib/colors";
import { Sheet } from "./sheet";
import { Text } from "./text";
import { Tile } from "./tile";

// The Calendar's + (Figma D9 549:2): book a time now, or hold one while the player decides, each
// a drawn tile. The time is picked next, on its own screen.

export type AddAction = "book" | "hold";

const SOFT = "#c9d6ff";
const SOFT_FILL = "#f2f4ff";
const ART = { width: 120, height: 66 };

export function AddSheet({
  holdMinutes,
  visible,
  onClose,
  onHidden,
  onPick,
}: {
  // How long a staff hold lasts at the venue, once known.
  holdMinutes: number | null;
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  onPick: (action: AddAction) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.calendar.addSheet.title")}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {t("screens.calendar.addSheet.body")}
      </Text>
      <View className="mb-2 flex-row gap-3">
        <Tile
          title={t("screens.calendar.addSheet.book")}
          body={t("screens.calendar.addSheet.bookBody")}
          art={<BookArt />}
          onPress={() => onPick("book")}
        />
        <Tile
          title={t("screens.calendar.addSheet.hold")}
          body={
            holdMinutes === null
              ? t("screens.calendar.addSheet.holdBodyPlain")
              : t("screens.calendar.addSheet.holdBody", { count: holdMinutes })
          }
          art={<HoldArt />}
          onPress={() => onPick("hold")}
        />
      </View>
    </Sheet>
  );
}

// A new booking dropped into an empty time: a blue card in a dashed outline, a + on its corner.
function BookArt() {
  return (
    <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Rect
        x={18.5}
        y={14.5}
        width={83}
        height={41}
        rx={7}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <Rect x={26} y={22} width={68} height={26} rx={6} fill={colors.primary} />
      <Rect x={34} y={30} width={34} height={3} rx={1.5} fill={colors.white} />
      <Rect x={34} y={37} width={20} height={2.5} rx={1.25} fill={colors.white} opacity={0.7} />
      <Circle cx={101} cy={14} r={9} fill={colors.primary} stroke={colors.white} strokeWidth={2} />
      <Path
        d="M101 10 V18 M97 14 H105"
        stroke={colors.white}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// A time set aside: a soft dashed card with a lock, and a ring running down on its corner.
function HoldArt() {
  return (
    <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Rect
        x={18.5}
        y={14.5}
        width={83}
        height={41}
        rx={7}
        fill={SOFT_FILL}
        stroke={colors.primary}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      {/* The lock: a shackle over a body. */}
      <Path
        d="M30 33 V30.5 a4 4 0 0 1 8 0 V33"
        stroke={colors.primary}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <Rect
        x={28}
        y={33}
        width={12}
        height={9}
        rx={2}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.6}
      />
      <Rect x={48} y={30} width={34} height={3} rx={1.5} fill={SOFT} />
      <Rect x={48} y={37} width={20} height={2.5} rx={1.25} fill={SOFT} />
      {/* The ring: most of it still to run. */}
      <Circle cx={101} cy={14} r={8} fill={colors.white} />
      <Circle cx={101} cy={14} r={6.5} stroke={SOFT} strokeWidth={2.2} fill="none" />
      <Path
        d="M101 7.5 A6.5 6.5 0 1 1 94.5 14"
        stroke={colors.primary}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
