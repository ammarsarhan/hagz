import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { colors } from "@/lib/colors";
import {
  GRID_ROWS,
  GRID_START,
  blockBetween,
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
// a cell per hour, from 6 am down to 5 am the next morning, so each late night sits under its
// evening. Normal hours light blue, peak solid blue, discount dashed diagonally on the light tint,
// closed white with a hairline.
//
// Tapping a cell selects it; holding one and dragging selects the block between it and the finger
// (a hold first, so a plain drag still scrolls the page). The selection is outlined in grey and
// handed up to be marked ("E2 · Mark a selection", 470:181).
const CELL = 22;
const GAP = 4;
const ROW = CELL + GAP;
const RADIUS = 6;
const LABELS = 44;
const HEADER = 26;
// Holding this long turns a touch into a selection drag.
const HOLD = 220;
const NORMAL = "#dce5ff";

const fillOf = (tier: Tier | null) =>
  tier === "PEAK" ? colors.primary : tier === "BASE" ? NORMAL : colors.white;

// The discount fill: dashed lines at 45°, in the screen's space rather than each cell's, so the
// stripes run on from one cell into the next.
function Hatch({ id }: { id: string }) {
  return (
    <Defs>
      <Pattern
        id={id}
        width={6}
        height={6}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <Line
          x1={0}
          y1={0}
          x2={0}
          y2={6}
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

  // Columns run 6 am to 6 am, so a day's open hours are read from its cells, not its calendar day.
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
    ? (() => {
        const left = Math.min(xOf(selection.fromDay), xOf(selection.toDay));
        const days = selection.toDay - selection.fromDay + 1;
        return (
          <Rect
            x={left + 0.25}
            y={selection.fromRow * ROW + 0.25}
            width={days * column - 0.5}
            height={(selection.toRow - selection.fromRow + 1) * ROW - 0.5}
            rx={RADIUS + 2}
            fill="none"
            stroke={colors.ink3}
            strokeWidth={2.5}
          />
        );
      })()
    : null;

  return (
    <View className="flex-row">
      {/* Every other hour down the side, level with the top of its row. */}
      <View style={{ width: LABELS, paddingTop: HEADER }}>
        {Array.from({ length: GRID_ROWS }, (_, row) => (
          <View key={row} style={{ height: ROW }}>
            {row % 2 === 0 ? (
              <Text className="text-caption leading-[14px] text-ink-3" numberOfLines={1}>
                {hourLabel(t, GRID_START + row)}
              </Text>
            ) : null}
          </View>
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
                {outline}
              </Svg>
            ) : null}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

// The key under the grid: what each fill means.
export function TierSwatch({ tier }: { tier: Tier | null }) {
  return (
    <Svg width={18} height={12}>
      <Hatch id="swatch" />
      <Rect
        x={tier === null ? 0.5 : 0}
        y={tier === null ? 0.5 : 0}
        width={tier === null ? 17 : 18}
        height={tier === null ? 11 : 12}
        rx={3}
        fill={tier === "DISCOUNT" ? colors.blueTint : fillOf(tier)}
        stroke={tier === null ? colors.border : undefined}
      />
      {tier === "DISCOUNT" ? <Rect width={18} height={12} rx={3} fill="url(#swatch)" /> : null}
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
