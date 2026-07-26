import { useCallback, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedRef,
  withTiming,
  runOnJS,
  measure,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const HOURS = 24;
const MIN_GAP = 1;
const HANDLE_TOUCH_SIZE = 44;

export type SegmentType = 'base' | 'peak' | 'discount';

export interface PriceRange {
  startHour: number;
  endHour: number;
}

export interface PriceSchedule {
  base: PriceRange;
  peak: PriceRange;
  discount: PriceRange;
}

const SEGMENT_ORDER: SegmentType[] = ['base', 'peak', 'discount'];

const COLORS: Record<SegmentType, string> = {
  base: '#1F4F33',
  peak: '#2314CE',
  discount: '#DCFC3A',
};

const LABELS: Record<SegmentType, string> = {
  base: 'Base',
  peak: 'Peak',
  discount: 'Discount',
};

const GAP_COLOR = '#E3E3E3';

const DEFAULT_SCHEDULE: PriceSchedule = {
  base: { startHour: 9, endHour: 17 },
  peak: { startHour: 18, endHour: 22 },
  discount: { startHour: 0, endHour: 6 },
};

function hourToAngle(hour: number) {
  'worklet';
  return (hour / HOURS) * 360 - 90;
}

function angleToHour(angleDeg: number) {
  'worklet';
  const normalized = (((angleDeg + 90) % 360) + 360) % 360;
  return (normalized / 360) * HOURS;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  'worklet';
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function forwardSpan(from: number, to: number) {
  'worklet';
  return (((to - from) % HOURS) + HOURS) % HOURS || HOURS;
}

function describeDonutArc(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startHour: number,
    spanHours: number
) {
    'worklet';
    const startAngle = hourToAngle(startHour);
    const endAngle = startAngle + (spanHours / HOURS) * 360;
    const largeArc = spanHours > 12 ? 1 : 0;

    const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
    const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
    const startInner = polarToCartesian(cx, cy, innerR, endAngle);
    const endInner = polarToCartesian(cx, cy, innerR, startAngle);

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      'Z',
    ].join(' ');
}

function maxForwardExtension(fromHour: number, others: { start: number; end: number }[]) {
  'worklet';
  let m = HOURS;
  for (let i = 0; i < others.length; i++) {
    const d = forwardSpan(fromHour, others[i].start);
    if (d < m) m = d;
  }
  return m;
}

function maxBackwardExtension(toHour: number, others: { start: number; end: number }[]) {
  'worklet';
  let m = HOURS;
  for (let i = 0; i < others.length; i++) {
    const d = forwardSpan(others[i].end, toHour);
    if (d < m) m = d;
  }
  return m;
}

function clampSpanExtend(rawSpan: number, minGap: number, maxAllowed: number) {
  'worklet';
  if (maxAllowed < minGap) return Math.max(0.05, Math.min(rawSpan, maxAllowed));
  return Math.min(Math.max(rawSpan, minGap), maxAllowed);
}

function formatHour(h: number) {
  const hour = Math.round(h) % HOURS;
  return `${hour.toString().padStart(2, '0')}:00`;
}

function segmentDuration(r: PriceRange) {
  return ((r.endHour - r.startHour + HOURS) % HOURS) || HOURS;
}

interface ScheduleCircleProps {
  size?: number;
  initialSchedule?: Partial<PriceSchedule>;
  onChange?: (schedule: PriceSchedule) => void;
  hapticsEnabled?: boolean;
}

export default function ScheduleCircle({ size = 280, initialSchedule, onChange, hapticsEnabled = true }: ScheduleCircleProps) {
  const initial: PriceSchedule = {
    base: initialSchedule?.base ?? DEFAULT_SCHEDULE.base,
    peak: initialSchedule?.peak ?? DEFAULT_SCHEDULE.peak,
    discount: initialSchedule?.discount ?? DEFAULT_SCHEDULE.discount,
  };

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 30;
  const innerR = outerR - 34;
  const handleRadius = (innerR + outerR) / 2;

  const containerRef = useAnimatedRef<Animated.View>();
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);

  const baseStart = useSharedValue(initial.base.startHour);
  const baseEnd = useSharedValue(initial.base.endHour);
  const peakStart = useSharedValue(initial.peak.startHour);
  const peakEnd = useSharedValue(initial.peak.endHour);
  const discountStart = useSharedValue(initial.discount.startHour);
  const discountEnd = useSharedValue(initial.discount.endHour);

  const [schedule, setSchedule] = useState<PriceSchedule>(initial);

  const updateSegment = useCallback(
    (key: SegmentType, startHour: number, endHour: number) => {
      setSchedule((prev) => {
        const next = { ...prev, [key]: { startHour, endHour } };
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const tick = useCallback(() => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [hapticsEnabled]);

  function makeHandleGesture(
    key: SegmentType,
    own: { start: SharedValue<number>; end: SharedValue<number> },
    others: { start: SharedValue<number>; end: SharedValue<number> }[],
    which: 'start' | 'end'
  ) {
    return Gesture.Pan()
      .onBegin(() => {
        const layout = measure(containerRef);
        if (layout) {
          centerX.value = layout.pageX + cx;
          centerY.value = layout.pageY + cy;
        }
      })
      .onUpdate((e) => {
        const angle =
          (Math.atan2(e.absoluteY - centerY.value, e.absoluteX - centerX.value) * 180) / Math.PI;
        const rawHour = angleToHour(angle);
        const otherRanges = others.map((o) => ({ start: o.start.value, end: o.end.value }));
        const prevLen = forwardSpan(own.start.value, own.end.value);

        if (which === 'end') {
          const start = own.start.value;
          const rawLen = forwardSpan(start, rawHour);
          const maxExt = maxForwardExtension(start, otherRanges);
          const len = clampSpanExtend(rawLen, MIN_GAP, maxExt);
          own.end.value = (start + len) % HOURS;
          if (Math.floor(len) !== Math.floor(prevLen)) runOnJS(tick)();
        } else {
          const end = own.end.value;
          const rawLen = forwardSpan(rawHour, end);
          const maxExt = maxBackwardExtension(end, otherRanges);
          const len = clampSpanExtend(rawLen, MIN_GAP, maxExt);
          own.start.value = ((end - len) % HOURS + HOURS) % HOURS;
          if (Math.floor(len) !== Math.floor(prevLen)) runOnJS(tick)();
        }
      })
      .onEnd(() => {
        if (which === 'end') {
          const rounded = Math.round(own.end.value) % HOURS;
          own.end.value = withTiming(rounded, { duration: 150, easing: Easing.out(Easing.quad) });
          runOnJS(updateSegment)(key, Math.round(own.start.value) % HOURS, rounded);
        } else {
          const rounded = Math.round(own.start.value) % HOURS;
          own.start.value = withTiming(rounded, { duration: 150, easing: Easing.out(Easing.quad) });
          runOnJS(updateSegment)(key, rounded, Math.round(own.end.value) % HOURS);
        }
      });
  }

  const base = { start: baseStart, end: baseEnd };
  const peak = { start: peakStart, end: peakEnd };
  const discount = { start: discountStart, end: discountEnd };

  const baseStartGesture = useMemo(() => makeHandleGesture('base', base, [peak, discount], 'start'), []);
  const baseEndGesture = useMemo(() => makeHandleGesture('base', base, [peak, discount], 'end'), []);
  const peakStartGesture = useMemo(() => makeHandleGesture('peak', peak, [base, discount], 'start'), []);
  const peakEndGesture = useMemo(() => makeHandleGesture('peak', peak, [base, discount], 'end'), []);
  const discountStartGesture = useMemo(
    () => makeHandleGesture('discount', discount, [base, peak], 'start'),
    []
  );
  const discountEndGesture = useMemo(() => makeHandleGesture('discount', discount, [base, peak], 'end'), []);

  const baseArcProps = useAnimatedProps(() => ({
    d: describeDonutArc(cx, cy, innerR, outerR, baseStart.value, forwardSpan(baseStart.value, baseEnd.value)),
  }));
  const peakArcProps = useAnimatedProps(() => ({
    d: describeDonutArc(cx, cy, innerR, outerR, peakStart.value, forwardSpan(peakStart.value, peakEnd.value)),
  }));
  const discountArcProps = useAnimatedProps(() => ({
    d: describeDonutArc(
      cx,
      cy,
      innerR,
      outerR,
      discountStart.value,
      forwardSpan(discountStart.value, discountEnd.value)
    ),
  }));

  function useHandlePositionStyle(hourValue: SharedValue<number>) {
    return useAnimatedStyle(() => {
      const p = polarToCartesian(cx, cy, handleRadius, hourToAngle(hourValue.value));
      return {
        transform: [
          { translateX: p.x - HANDLE_TOUCH_SIZE / 2 },
          { translateY: p.y - HANDLE_TOUCH_SIZE / 2 },
        ],
      };
    });
  }

  const baseStartStyle = useHandlePositionStyle(baseStart);
  const baseEndStyle = useHandlePositionStyle(baseEnd);
  const peakStartStyle = useHandlePositionStyle(peakStart);
  const peakEndStyle = useHandlePositionStyle(peakEnd);
  const discountStartStyle = useHandlePositionStyle(discountStart);
  const discountEndStyle = useHandlePositionStyle(discountEnd);

  const ticks = useMemo(() => {
    const items: { x1: number; y1: number; x2: number; y2: number; label?: string; lx: number; ly: number }[] = [];

    for (let h = 0; h < HOURS; h++) {
      const angle = hourToAngle(h);
      const outer = polarToCartesian(cx, cy, outerR + 6, angle);
      const inner = polarToCartesian(cx, cy, outerR + (h % 3 === 0 ? 16 : 10), angle);
      const labelPos = polarToCartesian(cx, cy, outerR + 27, angle);

      items.push({
        x1: outer.x,
        y1: outer.y,
        x2: inner.x,
        y2: inner.y,
        label: h % 3 === 0 ? String(h) : undefined,
        lx: labelPos.x,
        ly: labelPos.y,
      });
    };

    return items;
  }, [cx, cy, outerR]);

  const assignedHours = SEGMENT_ORDER.reduce((sum, key) => sum + segmentDuration(schedule[key]), 0);
  const unassignedHours = Math.max(0, HOURS - assignedHours);

  return (
    <View className="items-center">
      <Animated.View ref={containerRef} collapsable={false} style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={(innerR + outerR) / 2} stroke={GAP_COLOR} strokeWidth={outerR - innerR} fill="none" />
          <Circle cx={cx} cy={cy} r={outerR + 1} fill="none" stroke="#E5E5E5" strokeWidth={1} />
          <AnimatedPath animatedProps={baseArcProps} fill={COLORS.base} />
          <AnimatedPath animatedProps={peakArcProps} fill={COLORS.peak} />
          <AnimatedPath animatedProps={discountArcProps} fill={COLORS.discount} />
          {
            ticks.map((t, i) => (
              <Path key={i} d={`M ${t.x1} ${t.y1} L ${t.x2} ${t.y2}`} stroke="#999999" strokeWidth={1.5} />
            ))
          }
        </Svg>
        {
          ticks
            .filter((t) => t.label !== undefined)
            .map((t, i) => (
              <Text
                key={i}
                className="absolute w-5 text-center text-xs text-neutral-600"
                style={{ left: t.lx - 10, top: t.ly - 8 }}
              >
                {t.label}
              </Text>
            ))
        }
        <GestureDetector gesture={baseStartGesture}>
          <Animated.View
            className="absolute h-11 w-11 items-center justify-center"
            style={baseStartStyle}
          >
            <View className="h-6 w-6 rounded-full border-2 border-white" style={{ backgroundColor: COLORS.base }} />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={baseEndGesture}>
          <Animated.View
            className="absolute h-11 w-11 items-center justify-center"
            style={baseEndStyle}
          >
            <View className="h-6 w-6 rounded-full border-4 bg-white" style={{ borderColor: COLORS.base }} />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={peakStartGesture}>
          <Animated.View
            className="absolute h-11 w-11 items-center justify-center"
            style={peakStartStyle}
          >
            <View className="h-6 w-6 rounded-full border-2 border-white" style={{ backgroundColor: COLORS.peak }} />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={peakEndGesture}>
          <Animated.View
            className="absolute h-11 w-11 items-center justify-center"
            style={peakEndStyle}
          >
            <View className="h-6 w-6 rounded-full border-4 bg-white" style={{ borderColor: COLORS.peak }} />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={discountStartGesture}>
          <Animated.View
            className="absolute h-11 w-11 items-center justify-center"
            style={discountStartStyle}
          >
            <View
              className="h-6 w-6 rounded-full border-2 border-white"
              style={{ backgroundColor: COLORS.discount }}
            />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={discountEndGesture}>
          <Animated.View
            className="absolute h-11 w-11 items-center justify-center"
            style={discountEndStyle}
          >
            <View className="h-6 w-6 rounded-full border-4 bg-white" style={{ borderColor: COLORS.discount }} />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
      <View className="mt-5 w-full">
        {
          SEGMENT_ORDER.map((type) => {
            const r = schedule[type];
            return (
              <View key={type} className="flex-row items-center py-1.5">
                <View className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[type] }} />
                <Text className="flex-1 text-sm font-semibold" style={{ color: COLORS[type] }}>
                  {LABELS[type]}
                </Text>
                <Text className="text-sm text-neutral-800">
                  {formatHour(r.startHour)} – {formatHour(r.endHour)}
                </Text>
              </View>
            );
          })
        }
        <View className="flex-row items-center py-1.5">
          <View className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: GAP_COLOR }} />
          <Text className="flex-1 text-sm font-semibold" style={{ color: COLORS.base }}>
            Unassigned
          </Text>
          <Text className="text-sm text-neutral-800">{unassignedHours}h</Text>
        </View>
      </View>
    </View>
  );
}