import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { colors } from "@/lib/colors";
import {
  GRID_ROWS,
  GRID_START,
  blockBetween,
  blockHours,
  hourLabel,
  hourOfCell,
  shortDayName,
  type CellBlock,
  type Ring,
  type Tier,
} from "@/lib/hours";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

// A ground's week as a grid you paint (Figma "E1 · Paint the week", 470:11): a column per day and
// a cell per hour, from 12 am down to the next midnight. Normal hours light blue, peak solid blue,
// discount dashed diagonally on the light tint, closed white with a hairline.
//
// Tapping a cell selects it; holding one and dragging selects the block between it and the finger
// (a hold first, so a plain drag still scrolls the page). The selection is outlined in grey, solid
// round one cell and dashed, the dashes running round, round several, and handed up to be marked
// ("E2 · Mark a selection", 470:181).
const CELL = 22;
const GAP = 4;
const ROW = CELL + GAP;
const RADIUS = 6;
const LABELS = 48;
// A label's line box starts this far above its letters (13 px text on an 18 px line), so lifting
// it by this much puts the letters level with the top of their cell.
const LABEL_LIFT = 3;
const HEADER = 26;
// Holding this long turns a touch into a selection drag.
const HOLD = 220;
const NORMAL = "#dce5ff";
const OUTLINE = 2.5;
// Lighter than the ink-3 greys, so the outline marks the selection without weighing on it.
const OUTLINE_COLOR = "#c4c8cf";
// The outline gliding to the next cell, and fading in or out.
const GLIDE = { duration: 140, easing: Easing.out(Easing.cubic) };
const FADE = { duration: 120 };
// The dashes round a block: their pattern, and one pattern's length run round in this long.
const DASH = [6, 4];
const MARCH = 450;

const SWATCH = { width: 22, height: 14 };

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const fillOf = (tier: Tier | null) =>
  tier === "PEAK" ? colors.primary : tier === "BASE" ? NORMAL : colors.white;

// The discount fill: dashed lines at 45°, in the screen's space rather than each cell's, so the
// stripes run on from one cell into the next. The tile is two dash lengths tall, so every dash is
// whole.
function Hatch({ id }: { id: string }) {
  return (
    <Defs>
      <Pattern
        id={id}
        width={6}
        height={9}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <Line
          x1={0}
          y1={0}
          x2={0}
          y2={9}
          stroke={colors.primary}
          strokeWidth={1.4}
          strokeDasharray="2.5 2"
        />
      </Pattern>
    </Defs>
  );
}

export function HoursGrid({
  ring,
  selection,
  onSelect,
  onDragChange,
}: {
  ring: Ring;
  selection: CellBlock | null;
  onSelect: (block: CellBlock | null) => void;
  // On while a finger is dragging a selection, so the page doesn't scroll under it.
  onDragChange: (dragging: boolean) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const column = width / 7;
  // Sunday on the left in English, on the right in Arabic. The SVG doesn't mirror, so columns are
  // placed (and touches read) by hand.
  const xOf = (day: number) => (isRTL ? 6 - day : day) * column;
  const cellAt = (x: number, y: number) => {
    const col = Math.min(6, Math.max(0, Math.floor(x / column)));
    return {
      day: isRTL ? 6 - col : col,
      row: Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(y / ROW))),
    };
  };

  // Where the drag started, and the cell under the finger now.
  const drag = useRef<{ anchor: { day: number; row: number }; key: string } | null>(null);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(HOLD)
    .onStart((event) => {
      const anchor = cellAt(event.x, event.y);
      drag.current = { anchor, key: `${anchor.day}:${anchor.row}` };
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDragChange(true);
      onSelect(blockBetween(anchor, anchor));
    })
    .onUpdate((event) => {
      const current = drag.current;
      if (!current) return;
      const cell = cellAt(event.x, event.y);
      const key = `${cell.day}:${cell.row}`;
      if (key === current.key) return;
      current.key = key;
      void Haptics.selectionAsync();
      onSelect(blockBetween(current.anchor, cell));
    })
    .onFinalize(() => {
      if (drag.current) onDragChange(false);
      drag.current = null;
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      const cell = cellAt(event.x, event.y);
      // Tapping the one selected cell again lets it go.
      const same =
        selection !== null &&
        selection.fromDay === selection.toDay &&
        selection.fromRow === selection.toRow &&
        selection.fromDay === cell.day &&
        selection.fromRow === cell.row;
      void Haptics.selectionAsync();
      onSelect(same ? null : blockBetween(cell, cell));
    });
  // The tap only counts once the hold has failed, i.e. the finger lifted before it.
  const gesture = Gesture.Exclusive(pan, tap);

  const openDays = new Set<number>();
  const cells = [];
  for (let day = 0; day < 7; day += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      const tier = ring[hourOfCell(day, row)] ?? null;
      if (tier !== null) openDays.add(day);
      const x = xOf(day) + GAP / 2;
      const y = row * ROW + GAP / 2;
      const w = column - GAP;
      const key = `${day}:${row}`;
      cells.push(
        tier === "DISCOUNT" ? (
          <Rect key={key} x={x} y={y} width={w} height={CELL} rx={RADIUS} fill={colors.blueTint} />
        ) : (
          <Rect
            key={key}
            x={tier === null ? x + 0.5 : x}
            y={tier === null ? y + 0.5 : y}
            width={tier === null ? w - 1 : w}
            height={tier === null ? CELL - 1 : CELL}
            rx={RADIUS}
            fill={fillOf(tier)}
            stroke={tier === null ? colors.border : undefined}
            strokeWidth={1}
          />
        ),
      );
      if (tier === "DISCOUNT") {
        cells.push(
          <Rect
            key={`${key}h`}
            x={x}
            y={y}
            width={w}
            height={CELL}
            rx={RADIUS}
            fill="url(#discount)"
          />,
        );
      }
    }
  }

  const outline = selection
    ? {
        x: Math.min(xOf(selection.fromDay), xOf(selection.toDay)) + OUTLINE / 2,
        y: selection.fromRow * ROW + OUTLINE / 2,
        width: (selection.toDay - selection.fromDay + 1) * column - OUTLINE,
        height: (selection.toRow - selection.fromRow + 1) * ROW - OUTLINE,
        bulk: blockHours(selection) > 1,
      }
    : null;

  return (
    <View className="flex-row">
      {/* Every other hour down the side, its letters level with the top of its cell. */}
      <View style={{ width: LABELS, height: HEADER + GRID_ROWS * ROW }}>
        {Array.from({ length: GRID_ROWS / 2 }, (_, i) => (
          <Text
            key={i}
            className="absolute text-caption text-ink-3"
            style={{ start: 0, top: HEADER + i * 2 * ROW + GAP / 2 - LABEL_LIFT }}
          >
            {hourLabel(t, GRID_START + i * 2)}
          </Text>
        ))}
      </View>
      <View className="flex-1" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View className="flex-row" style={{ height: HEADER }}>
          {Array.from({ length: 7 }, (_, day) => (
            <Text
              key={day}
              // A day with no open hours is quieter.
              className={`flex-1 text-center text-caption font-medium ${openDays.has(day) ? "" : "text-ink-3"}`}
              numberOfLines={1}
            >
              {shortDayName(t, day)}
            </Text>
          ))}
        </View>
        <GestureDetector gesture={gesture}>
          <View
            accessible
            accessibilityLabel={t("screens.setup.hours.gridLabel")}
            style={{ height: GRID_ROWS * ROW }}
          >
            {width > 0 ? (
              <Svg width={width} height={GRID_ROWS * ROW}>
                <Hatch id="discount" />
                {cells}
                <SelectionOutline outline={outline} />
              </Svg>
            ) : null}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

// The selection's outline. It glides to each new block rather than jumping, so a drag feels like
// one movement; it fades in on the first cell and out when let go. Round one cell it's a solid
// line; round several the line breaks into dashes that run round it, so a bulk edit reads as one.
function SelectionOutline({
  outline,
}: {
  outline: { x: number; y: number; width: number; height: number; bulk: boolean } | null;
}) {
  const x = useSharedValue(outline?.x ?? 0);
  const y = useSharedValue(outline?.y ?? 0);
  const width = useSharedValue(outline?.width ?? 0);
  const height = useSharedValue(outline?.height ?? 0);
  const opacity = useSharedValue(outline ? 1 : 0);
  const offset = useSharedValue(0);
  const shown = useRef(outline !== null);
  const bulk = outline?.bulk ?? false;

  useEffect(() => {
    if (!outline) {
      opacity.value = withTiming(0, FADE);
      shown.current = false;
      return;
    }
    if (shown.current) {
      x.value = withTiming(outline.x, GLIDE);
      y.value = withTiming(outline.y, GLIDE);
      width.value = withTiming(outline.width, GLIDE);
      height.value = withTiming(outline.height, GLIDE);
    } else {
      // Appearing: straight onto the cell, not gliding over from the last selection.
      x.value = outline.x;
      y.value = outline.y;
      width.value = outline.width;
      height.value = outline.height;
      opacity.value = withTiming(1, FADE);
      shown.current = true;
    }
  }, [outline?.x, outline?.y, outline?.width, outline?.height, outline === null]);

  useEffect(() => {
    if (!bulk) {
      cancelAnimation(offset);
      offset.value = 0;
      return;
    }
    const period = DASH.reduce((sum, part) => sum + part, 0);
    offset.value = 0;
    offset.value = withRepeat(withTiming(-period, { duration: MARCH, easing: Easing.linear }), -1);
    return () => cancelAnimation(offset);
  }, [bulk, offset]);

  const props = useAnimatedProps(() => ({
    x: x.value,
    y: y.value,
    width: width.value,
    height: height.value,
    opacity: opacity.value,
    strokeDashoffset: offset.value,
  }));

  return (
    <AnimatedRect
      animatedProps={props}
      rx={RADIUS + 2}
      fill="none"
      stroke={OUTLINE_COLOR}
      strokeWidth={OUTLINE}
      // "1 0" is a solid line; switching between patterns keeps the same prop type.
      strokeDasharray={bulk ? DASH.join(" ") : "1 0"}
    />
  );
}

// The key under the grid: what each fill means.
export function TierSwatch({ tier }: { tier: Tier | null }) {
  // A small piece of a cell, big enough for the discount's dashes to read as they do on the grid.
  const closed = tier === null;
  return (
    <Svg width={SWATCH.width} height={SWATCH.height}>
      <Hatch id="swatch" />
      <Rect
        x={closed ? 0.5 : 0}
        y={closed ? 0.5 : 0}
        width={closed ? SWATCH.width - 1 : SWATCH.width}
        height={closed ? SWATCH.height - 1 : SWATCH.height}
        rx={4}
        fill={tier === "DISCOUNT" ? colors.blueTint : fillOf(tier)}
        stroke={closed ? colors.border : undefined}
      />
      {tier === "DISCOUNT" ? (
        <Rect width={SWATCH.width} height={SWATCH.height} rx={4} fill="url(#swatch)" />
      ) : null}
    </Svg>
  );
}

export function GridKey() {
  const { t } = useTranslation();
  const tiers: { tier: Tier | null; label: string }[] = [
    { tier: "BASE", label: t("screens.setup.hours.normal") },
    { tier: "PEAK", label: t("screens.setup.hours.peak") },
    { tier: "DISCOUNT", label: t("screens.setup.hours.discount") },
    { tier: null, label: t("screens.setup.hours.closed") },
  ];
  return (
    <View className="mt-4 flex-row flex-wrap gap-x-[18px] gap-y-2">
      {tiers.map(({ tier, label }) => (
        <View key={label} className="flex-row items-center gap-2">
          <TierSwatch tier={tier} />
          <Text className="text-caption text-ink-2">{label}</Text>
        </View>
      ))}
    </View>
  );
}
