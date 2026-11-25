import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/lib/colors";
import { Sheet } from "./sheet";
import { Text } from "./text";

// A booking's ⋯ (Figma D9 598:3): whose booking and when, then a tile for each thing to do to it,
// each drawing what it does rather than an icon list: Move it to a free time, Swap it with another
// booking. For bookings still to be played (the API's MOVABLE, before kick-off), for staff who may.

export type MenuAction = "move" | "swap";

// The calendar's colours for a booking and a weekly week waiting, as the drawings' two bookings.
const SOFT = "#c9d6ff";
const ART = { width: 120, height: 66 };

export function BookingMenu({
  name,
  when,
  visible,
  onClose,
  onHidden,
  onPick,
}: {
  // "Hany", and "Today, 7 – 8 pm · Pitch 3".
  name: string;
  when: string;
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  onPick: (action: MenuAction) => void;
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
        {t("screens.booking.menu.title", { name })}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">{when}</Text>
      <View className="mb-2 flex-row gap-3">
        <Tile
          title={t("screens.booking.menu.move")}
          body={t("screens.booking.menu.moveBody")}
          art={<MoveArt />}
          onPress={() => onPick("move")}
        />
        <Tile
          title={t("screens.booking.menu.swap")}
          body={t("screens.booking.menu.swapBody")}
          art={<SwapArt />}
          onPress={() => onPick("swap")}
        />
      </View>
    </Sheet>
  );
}

function Tile({
  title,
  body,
  art,
  onPress,
}: {
  title: string;
  body: string;
  art: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${body}`}
      onPress={onPress}
      className="flex-1 rounded-2xl border border-border px-4 pt-5 pb-4 active:opacity-70"
    >
      <View className="items-center">{art}</View>
      <Text className="mt-4 text-subtitle font-semibold">{title}</Text>
      <Text className="mt-0.5 text-caption text-ink-2">{body}</Text>
    </Pressable>
  );
}

// A booking card: a blue block with its two lines, or the soft one being traded with.
function Card({ y, soft = false }: { y: number; soft?: boolean }) {
  const line = soft ? colors.primary : colors.white;
  return (
    <>
      <Rect x={24} y={y} width={72} height={24} rx={6} fill={soft ? SOFT : colors.primary} />
      <Rect x={32} y={y + 7} width={34} height={3} rx={1.5} fill={line} />
      <Rect x={32} y={y + 14} width={20} height={2.5} rx={1.25} fill={line} opacity={0.7} />
    </>
  );
}

// A curve ending in an arrowhead, its head turned along the curve's last stretch.
function Arrow({ d, from, to }: { d: string; from: [number, number]; to: [number, number] }) {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  const back = (side: number): string =>
    `${to[0] - ux * 5 + -uy * 4 * side},${to[1] - uy * 5 + ux * 4 * side}`;
  return (
    <>
      <Path d={d} stroke={colors.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path
        d={`M${back(1)} L${to[0]},${to[1]} L${back(-1)}`}
        stroke={colors.ink}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// The booking lifted to a free time: from its block, round to a dashed empty one below.
function MoveArt() {
  return (
    <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Card y={4} />
      <Rect
        x={24.5}
        y={40.5}
        width={71}
        height={23}
        rx={4}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <Arrow d="M100 14 C114 18 114 46 100 52" from={[114, 46]} to={[100, 52]} />
    </Svg>
  );
}

// Two bookings trading places: an arrow round each side.
function SwapArt() {
  return (
    <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Card y={4} />
      <Card y={40} soft />
      <Arrow d="M20 52 C6 46 6 20 20 14" from={[6, 20]} to={[20, 14]} />
      <Arrow d="M100 14 C114 18 114 46 100 52" from={[114, 46]} to={[100, 52]} />
    </Svg>
  );
}
