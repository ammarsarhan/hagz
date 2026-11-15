import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors } from "@/lib/colors";
import { hourLabel, length, type DayHours, type Range } from "@/lib/hours";
import { Text } from "./text";

// One day on a 24-hour clock face (Figma "Hours · Week A Dial per day", 370:2, and "Hours · Day C
// Drag a dial", 375:2): midnight at the top, running clockwise, so a late night reads as one arc
// over the top. Normal hours light blue, peak solid blue, discount marked with dotted edges. A
// clock, not a layout, so it never mirrors in Arabic.
//
// With `onHandleMove`, white handles sit on the ends being changed and follow a finger round the
// ring a whole hour at a time.
const HOUR_DEGREES = 360 / 24;
const STROKE = 20;
const HANDLE = 15;
// How close to a handle a touch must land to pick it up.
const REACH = 36;
const NORMAL = "#dce5ff";
const TRACK = "#f2f3f5";
const MINOR_TICK = "#d0d3d8";

export function HoursDial({
  size,
  day,
  title,
  detail,
  handles = [],
  onHandleMove,
  onDragChange,
}: {
  size: number;
  day: DayHours;
  title: string;
  detail: string;
  // Clock hours (0–23) of the handles being dragged, if any.
  handles?: number[];
  onHandleMove?: (handle: number, clock: number) => void;
  onDragChange?: (dragging: boolean) => void;
}) {
  const { t } = useTranslation();
  const centre = size / 2;
  const radius = centre - 26;
  const at = (hour: number, r: number) => {
    const angle = ((hour % 24) * HOUR_DEGREES * Math.PI) / 180;
    return { x: centre + r * Math.sin(angle), y: centre - r * Math.cos(angle) };
  };

  // The handle a drag picked up, and the clock hour it's on.
  const dragging = useRef<{ handle: number; clock: number } | null>(null);
  const clockAt = (x: number, y: number) => {
    const degrees = (Math.atan2(x - centre, centre - y) * 180) / Math.PI;
    return Math.round((((degrees % 360) + 360) % 360) / HOUR_DEGREES) % 24;
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .manualActivation(true)
    // Only a touch that lands on a handle drags; anywhere else is left to the page (and scrolls).
    .onTouchesDown((event, manager) => {
      const touch = event.allTouches[0];
      const near = touch
        ? handles
            .map((hour, handle) => {
              const point = at(hour, radius);
              return { handle, distance: Math.hypot(point.x - touch.x, point.y - touch.y) };
            })
            .sort((a, b) => a.distance - b.distance)[0]
        : undefined;
      if (!near || near.distance > REACH) return manager.fail();
      dragging.current = { handle: near.handle, clock: handles[near.handle] ?? 0 };
      manager.activate();
      onDragChange?.(true);
    })
    .onUpdate((event) => {
      const current = dragging.current;
      if (!current) return;
      const clock = clockAt(event.x, event.y);
      if (clock === current.clock) return;
      current.clock = clock;
      void Haptics.selectionAsync();
      onHandleMove?.(current.handle, clock);
    })
    .onFinalize(() => {
      if (dragging.current) onDragChange?.(false);
      dragging.current = null;
    });

  const arc = (range: Range, r: number) => {
    if (length(range) >= 24) return null;
    const from = at(range.start, r);
    const to = at(range.end, r);
    const large = length(range) > 12 ? 1 : 0;
    return `M ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y}`;
  };
  const band = (range: Range, color: string, key: string) => {
    const d = arc(range, radius);
    return d ? (
      <Path key={key} d={d} stroke={color} strokeWidth={STROKE} fill="none" />
    ) : (
      <Circle
        key={key}
        cx={centre}
        cy={centre}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
      />
    );
  };
  // Discount: dotted lines along both edges of the band.
  const dotted = (range: Range) =>
    [radius - STROKE / 2 + 1.5, radius + STROKE / 2 - 1.5].map((r) => {
      const d = arc(range, r);
      return d ? (
        <Path
          key={r}
          d={d}
          stroke={colors.primary}
          strokeWidth={2}
          strokeDasharray="0.6 4"
          fill="none"
        />
      ) : null;
    });

  const ticks = Array.from({ length: 24 }, (_, hour) => {
    const major = hour % 6 === 0;
    const outer = at(hour, radius - 16);
    const inner = at(hour, radius - (major ? 22 : 19));
    return (
      <Line
        key={hour}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={major ? colors.ink3 : MINOR_TICK}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    );
  });

  // 12 am, 6 am, 12 pm and 6 pm just outside the ring.
  const labels = [
    { hour: 0, x: centre, y: -4 },
    { hour: 6, x: size - 4, y: centre - 8 },
    { hour: 12, x: centre, y: size - 12 },
    { hour: 18, x: 4, y: centre - 8 },
  ];

  const face = (
    <View style={{ width: size, height: size, direction: "ltr" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={TRACK}
          strokeWidth={STROKE}
          fill="none"
        />
        {ticks}
        {day.open ? band(day.open, NORMAL, "open") : null}
        {day.peak ? band(day.peak, colors.primary, "peak") : null}
        {day.discount ? dotted(day.discount) : null}
        {handles.map((hour, i) => {
          const point = at(hour, radius);
          return (
            <Circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={HANDLE}
              fill={colors.white}
              stroke={colors.ink}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      {labels.map(({ hour, x, y }) => (
        <View
          key={hour}
          pointerEvents="none"
          style={{ position: "absolute", left: x - 30, top: y, width: 60 }}
        >
          <Text className="text-center text-[12px] text-ink-3">{hourLabel(t, hour)}</Text>
        </View>
      ))}
      <View
        pointerEvents="none"
        style={{ position: "absolute", inset: 0 }}
        className="items-center justify-center"
      >
        <Text className="text-center text-[22px] font-semibold leading-[1.27] tracking-[-0.3px]">
          {title}
        </Text>
        <Text className="mt-[3px] text-center text-label leading-[1.43] text-ink-2">{detail}</Text>
      </View>
    </View>
  );

  return onHandleMove ? <GestureDetector gesture={pan}>{face}</GestureDetector> : face;
}
