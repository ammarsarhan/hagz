/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
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
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { IconPlus } from '@tabler/icons-react-native';

const AnimatedPath =
  Animated.createAnimatedComponent(Path);

const HOURS = 24;
const MIN_GAP = 1;
const HANDLE_TOUCH_SIZE = 44;
const HANDLE_VISUAL_SIZE = 34;

export type SegmentType =
  | 'base'
  | 'peak'
  | 'discount';

export interface PriceRange {
  startHour: number;
  endHour: number;
}

export interface PriceSchedule {
  base: PriceRange;
  peak: PriceRange;
  discount: PriceRange;
}

const SEGMENT_ORDER: SegmentType[] = [
  'base',
  'peak',
  'discount',
];

const GRADIENT_STOPS: Record<
  SegmentType,
  [string, string]
> = {
  base: ['#5B3DF5', '#1C04EA'],
  peak: ['#FFAB78', '#FF7A45'],
  discount: ['#EAF6FF', '#BFE3FF'],
};

const DOT_CLASS: Record<
  SegmentType,
  string
> = {
  base: 'bg-[#1C04EA]',
  peak: 'bg-[#FF7A45]',
  discount: 'bg-[#BFE3FF]',
};

const BORDER_CLASS: Record<
  SegmentType,
  string
> = {
  base: 'border-[#1C04EA]',
  peak: 'border-[#FF7A45]',
  discount: 'border-[#BFE3FF]',
};

const TEXT_CLASS: Record<
  SegmentType,
  string
> = {
  base: 'text-[#1C04EA]',
  peak: 'text-[#FF7A45]',
  discount: 'text-[#4E9FE0]',
};

const LABELS: Record<
  SegmentType,
  string
> = {
  base: 'Base',
  peak: 'Peak',
  discount: 'Discount',
};

const GAP_COLOR = '#F9FAFB';
const ZERO_LINE_COLOR = '#6B728033';

const DEFAULT_SCHEDULE: PriceSchedule = {
  base: {
    startHour: 9,
    endHour: 17,
  },
  peak: {
    startHour: 18,
    endHour: 22,
  },
  discount: {
    startHour: 0,
    endHour: 6,
  },
};

function hourToAngle(hour: number) {
  'worklet';

  return (hour / HOURS) * 360 - 90;
}

function angleToHour(angleDeg: number) {
  'worklet';

  const normalized =
    (((angleDeg + 90) % 360) + 360) % 360;

  return (normalized / 360) * HOURS;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
) {
  'worklet';

  const rad =
    (angleDeg * Math.PI) / 180;

  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function forwardSpan(
  from: number,
  to: number,
) {
  'worklet';

  return (
    (((to - from) % HOURS) + HOURS) %
    HOURS
  );
}

function describeDonutArc(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startHour: number,
  spanHours: number,
) {
  'worklet';

  if (spanHours >= HOURS) {
    const startAngle =
      hourToAngle(startHour);

    const midAngle =
      startAngle + 180;

    const startOuter =
      polarToCartesian(
        cx,
        cy,
        outerR,
        startAngle,
      );

    const midOuter =
      polarToCartesian(
        cx,
        cy,
        outerR,
        midAngle,
      );

    const startInner =
      polarToCartesian(
        cx,
        cy,
        innerR,
        startAngle,
      );

    const midInner =
      polarToCartesian(
        cx,
        cy,
        innerR,
        midAngle,
      );

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${midOuter.x} ${midOuter.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${startOuter.x} ${startOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${midInner.x} ${midInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  }

  const startAngle =
    hourToAngle(startHour);

  const endAngle =
    startAngle +
    (spanHours / HOURS) * 360;

  const largeArc =
    spanHours > 12 ? 1 : 0;

  const startOuter =
    polarToCartesian(
      cx,
      cy,
      outerR,
      startAngle,
    );

  const endOuter =
    polarToCartesian(
      cx,
      cy,
      outerR,
      endAngle,
    );

  const startInner =
    polarToCartesian(
      cx,
      cy,
      innerR,
      endAngle,
    );

  const endInner =
    polarToCartesian(
      cx,
      cy,
      innerR,
      startAngle,
    );

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

function maxForwardExtension(
  fromHour: number,
  others: {
    start: number;
    end: number;
  }[],
) {
  'worklet';

  let maxExtension =
    HOURS - MIN_GAP;

  for (
    let i = 0;
    i < others.length;
    i++
  ) {
    const other = others[i];

    if (
      other.start === other.end
    ) {
      continue;
    }

    const distance =
      forwardSpan(
        fromHour,
        other.start,
      );

    if (
      distance > 0 &&
      distance < maxExtension
    ) {
      maxExtension = distance;
    }
  }

  return maxExtension;
}

function maxBackwardExtension(
  toHour: number,
  others: {
    start: number;
    end: number;
  }[],
) {
  'worklet';

  let maxExtension =
    HOURS - MIN_GAP;

  for (
    let i = 0;
    i < others.length;
    i++
  ) {
    const other = others[i];

    if (
      other.start === other.end
    ) {
      continue;
    }

    const distance =
      forwardSpan(
        other.end,
        toHour,
      );

    if (
      distance > 0 &&
      distance < maxExtension
    ) {
      maxExtension = distance;
    }
  }

  return maxExtension;
}

function maxLinearForwardExtension(
  fromHour: number,
  others: {
    start: number;
    end: number;
  }[],
) {
  'worklet';

  let maxExtension =
    HOURS - fromHour;

  for (
    let i = 0;
    i < others.length;
    i++
  ) {
    const other = others[i];

    if (
      other.start === other.end
    ) {
      continue;
    }

    if (
      other.start > fromHour
    ) {
      maxExtension = Math.min(
        maxExtension,
        other.start - fromHour,
      );
    }
  }

  return maxExtension;
}

function maxLinearBackwardExtension(
  toHour: number,
  others: {
    start: number;
    end: number;
  }[],
) {
  'worklet';

  let maxExtension = toHour;

  for (
    let i = 0;
    i < others.length;
    i++
  ) {
    const other = others[i];

    if (
      other.start === other.end
    ) {
      continue;
    }

    if (
      other.start > other.end
    ) {
      if (
        other.end < toHour
      ) {
        maxExtension = Math.min(
          maxExtension,
          toHour - other.end,
        );
      }
    } else if (
      other.end < toHour
    ) {
      maxExtension = Math.min(
        maxExtension,
        toHour - other.end,
      );
    }
  }

  return maxExtension;
}

function clampSpanExtend(
  rawSpan: number,
  minGap: number,
  maxAllowed: number,
) {
  'worklet';

  if (
    maxAllowed < minGap
  ) {
    return Math.max(
      0.05,
      Math.min(
        rawSpan,
        maxAllowed,
      ),
    );
  }

  return Math.min(
    Math.max(
      rawSpan,
      minGap,
    ),
    maxAllowed,
  );
}

function formatHour(h: number) {
  if (h === HOURS) {
    return '24:00';
  }

  const hour =
    Math.round(h) % HOURS;

  return `${hour
    .toString()
    .padStart(2, '0')}:00`;
}

function segmentDuration(
  r: PriceRange,
) {
  if (
    r.startHour === 0 &&
    r.endHour === HOURS
  ) {
    return HOURS;
  }

  if (
    r.startHour === r.endHour
  ) {
    return 0;
  }

  return r.endHour > r.startHour
    ? r.endHour - r.startHour
    : HOURS -
        r.startHour +
        r.endHour;
}

function HandleThumb({
  type,
}: {
  type: SegmentType;
}) {
  return (
    <View
      style={{
        width: HANDLE_VISUAL_SIZE,
        height: HANDLE_VISUAL_SIZE,
      }}
      className={`items-center justify-center rounded-full border-[2.5px] bg-white shadow-md ${BORDER_CLASS[type]}`}
    >
      <View className="flex-row gap-x-0.5">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className={`h-[11px] w-0.5 rounded-full opacity-[0.45] ${DOT_CLASS[type]}`}
          />
        ))}
      </View>
    </View>
  );
}

interface ScheduleCircleProps {
  size?: number;
  initialSchedule?: Partial<PriceSchedule>;
  onChange?: (
    schedule: PriceSchedule,
  ) => void;
  hapticsEnabled?: boolean;
  basePrice: number;
  peakPrice?: number;
  discountPrice?: number;
}

export default function ScheduleCircle({
  size = 280,
  initialSchedule,
  onChange,
  hapticsEnabled = true,
  basePrice,
  peakPrice,
  discountPrice,
}: ScheduleCircleProps) {
  const hasBase = true;

  const hasPeak =
    typeof peakPrice === 'number' &&
    peakPrice > 0;

  const hasDiscount =
    typeof discountPrice === 'number' &&
    discountPrice > 0;

  const initial = useMemo(() => {
    const s: PriceSchedule = {
      base: initialSchedule?.base
        ? {
            ...initialSchedule.base,
          }
        : {
            ...DEFAULT_SCHEDULE.base,
          },

      peak: initialSchedule?.peak
        ? {
            ...initialSchedule.peak,
          }
        : {
            ...DEFAULT_SCHEDULE.peak,
          },

      discount: initialSchedule?.discount
        ? {
            ...initialSchedule.discount,
          }
        : {
            ...DEFAULT_SCHEDULE.discount,
          },
    };

    const overlaps = (
      a: PriceRange,
      b: PriceRange,
    ) => {
      const aSpan =
        segmentDuration(a);

      const bSpan =
        segmentDuration(b);

      if (
        aSpan >= HOURS ||
        bSpan >= HOURS
      ) {
        return true;
      }

      const d1 =
        forwardSpan(
          a.startHour,
          b.startHour,
        );

      const d2 =
        forwardSpan(
          b.startHour,
          a.startHour,
        );

      return (
        d1 < aSpan ||
        d2 < bSpan
      );
    };

    if (hasDiscount) {
      const discountOverlapsBase =
        overlaps(
          s.discount,
          s.base,
        );

      const discountOverlapsPeak =
        hasPeak &&
        overlaps(
          s.discount,
          s.peak,
        );

      if (
        discountOverlapsBase ||
        discountOverlapsPeak
      ) {
        if (
          s.base.startHour ===
          s.discount.startHour
        ) {
          s.base.startHour =
            s.discount.endHour;
        } else if (
          segmentDuration(s.base) > 2
        ) {
          s.discount.startHour =
            s.base.startHour;

          s.discount.endHour =
            s.base.startHour + 2;

          s.base.startHour =
            s.base.startHour + 2;
        }
      }
    }

    if (hasPeak) {
      const peakOverlapsBase =
        overlaps(
          s.peak,
          s.base,
        );

      if (
        peakOverlapsBase &&
        segmentDuration(s.base) > 2
      ) {
        if (
          s.base.endHour ===
          s.peak.endHour
        ) {
          s.base.endHour =
            s.peak.startHour;
        } else {
          s.peak.startHour =
            s.base.endHour - 2;

          s.peak.endHour =
            s.base.endHour;

          s.base.endHour =
            s.peak.startHour;
        }
      }
    }

    return s;
  }, [
    initialSchedule,
    hasPeak,
    hasDiscount,
  ]);

  const cx = size / 2;
  const cy = size / 2;

  const outerR =
    size / 2 - 30;

  const innerR =
    outerR - 34;

  const handleRadius =
    (innerR + outerR) / 2;

  const containerRef =
    useAnimatedRef<Animated.View>();

  const centerX =
    useSharedValue(0);

  const centerY =
    useSharedValue(0);

  const baseStart =
    useSharedValue(
      initial.base.startHour,
    );

  const baseEnd =
    useSharedValue(
      initial.base.endHour,
    );

  const peakStart =
    useSharedValue(
      initial.peak.startHour,
    );

  const peakEnd =
    useSharedValue(
      initial.peak.endHour,
    );

  const discountStart =
    useSharedValue(
      initial.discount.startHour,
    );

  const discountEnd =
    useSharedValue(
      initial.discount.endHour,
    );

  const peakOpacity =
    useSharedValue(
      hasPeak &&
        segmentDuration(
          initial.peak,
        ) > 0
        ? 1
        : 0,
    );

  const discountOpacity =
    useSharedValue(
      hasDiscount &&
        segmentDuration(
          initial.discount,
        ) > 0
        ? 1
        : 0,
    );

  const [
    schedule,
    setSchedule,
  ] = useState<PriceSchedule>(
    initial,
  );

  const updateSegment =
    useCallback(
      (
        key: SegmentType,
        startHour: number,
        endHour: number,
      ) => {
        const next = {
          ...schedule,
          [key]: {
            startHour,
            endHour,
          },
        };

        setSchedule(next);
        onChange?.(next);
      },
      [
        onChange,
        schedule,
      ],
    );

  const tick =
    useCallback(() => {
      if (hapticsEnabled) {
        Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => {});
      }
    }, [
      hapticsEnabled,
    ]);

  function makeHandleGesture(
    key: SegmentType,
    own: {
      start: SharedValue<number>;
      end: SharedValue<number>;
    },
    others: {
      start: SharedValue<number>;
      end: SharedValue<number>;
    }[],
    which: 'start' | 'end',
  ) {
    return Gesture.Pan()
      .onBegin(() => {
        const layout =
          measure(containerRef);

        if (layout) {
          centerX.value =
            layout.pageX + cx;

          centerY.value =
            layout.pageY + cy;
        }
      })
      .onUpdate((e) => {
        const dx =
          e.absoluteX -
          centerX.value;

        const dy =
          e.absoluteY -
          centerY.value;

        const dist =
          Math.sqrt(
            dx * dx +
              dy * dy,
          );

        const angle =
          (Math.atan2(
            dy,
            dx,
          ) *
            180) /
          Math.PI;

        const pointerHour =
          angleToHour(angle);

        const prevHour =
          which === 'end'
            ? own.end.value
            : own.start.value;

        const settleRadius =
          innerR * 0.6;

        const influence =
          Math.max(
            0.06,
            Math.min(
              1,
              dist /
                settleRadius,
            ),
          );

        const shortestDelta =
          (((pointerHour -
            prevHour +
            HOURS / 2) %
            HOURS +
            HOURS) %
            HOURS) -
          HOURS / 2;

        const rawHour =
          ((prevHour +
            shortestDelta *
              influence) %
            HOURS +
            HOURS) %
          HOURS;

        const otherRanges =
          others.map((o) => ({
            start: o.start.value,
            end: o.end.value,
          }));

        const prevLen =
          key === 'base'
            ? Math.max(
                0,
                own.end.value -
                  own.start.value,
              )
            : forwardSpan(
                own.start.value,
                own.end.value,
              );

        let len: number;

        if (
          which === 'end'
        ) {
          const start =
            own.start.value;

          const rawLen =
            key === 'base'
              ? Math.max(
                  0,
                  rawHour -
                    start,
                )
              : forwardSpan(
                  start,
                  rawHour,
                );

          const maxExt =
            key === 'base'
              ? maxLinearForwardExtension(
                  start,
                  otherRanges,
                )
              : maxForwardExtension(
                  start,
                  otherRanges,
                );

          len =
            clampSpanExtend(
              rawLen,
              MIN_GAP,
              maxExt,
            );

          own.end.value =
            key === 'base'
              ? start + len
              : (start + len) %
                HOURS;
        } else {
          const end =
            own.end.value;

          const rawLen =
            key === 'base'
              ? Math.max(
                  0,
                  end -
                    rawHour,
                )
              : forwardSpan(
                  rawHour,
                  end,
                );

          const maxExt =
            key === 'base'
              ? maxLinearBackwardExtension(
                  end,
                  otherRanges,
                )
              : maxBackwardExtension(
                  end,
                  otherRanges,
                );

          len =
            clampSpanExtend(
              rawLen,
              MIN_GAP,
              maxExt,
            );

          own.start.value =
            key === 'base'
              ? end - len
              : ((end - len) %
                  HOURS +
                  HOURS) %
                HOURS;
        }

        if (
          Math.floor(len) !==
          Math.floor(prevLen)
        ) {
          runOnJS(tick)();
        }
      })
      .onEnd(() => {
        if (
          which === 'end'
        ) {
          const rounded =
            key === 'base'
              ? Math.min(
                  HOURS,
                  Math.max(
                    0,
                    Math.round(
                      own.end.value,
                    ),
                  ),
                )
              : Math.round(
                  own.end.value,
                ) % HOURS;

          own.end.value =
            withTiming(
              rounded,
              {
                duration: 150,
                easing:
                  Easing.out(
                    Easing.quad,
                  ),
              },
            );

          runOnJS(
            updateSegment,
          )(
            key,
            key === 'base'
              ? Math.min(
                  HOURS,
                  Math.max(
                    0,
                    Math.round(
                      own.start.value,
                    ),
                  ),
                )
              : Math.round(
                  own.start.value,
                ) % HOURS,
            rounded,
          );
        } else {
          const rounded =
            key === 'base'
              ? Math.min(
                  HOURS,
                  Math.max(
                    0,
                    Math.round(
                      own.start.value,
                    ),
                  ),
                )
              : Math.round(
                  own.start.value,
                ) % HOURS;

          own.start.value =
            withTiming(
              rounded,
              {
                duration: 150,
                easing:
                  Easing.out(
                    Easing.quad,
                  ),
              },
            );

          runOnJS(
            updateSegment,
          )(
            key,
            rounded,
            key === 'base'
              ? Math.min(
                  HOURS,
                  Math.max(
                    0,
                    Math.round(
                      own.end.value,
                    ),
                  ),
                )
              : Math.round(
                  own.end.value,
                ) % HOURS,
          );
        }
      });
  }

  const enabledSegments =
    useMemo(() => {
      const list: SegmentType[] =
        [];

      if (hasBase) {
        list.push('base');
      }

      if (hasPeak) {
        list.push('peak');
      }

      if (hasDiscount) {
        list.push('discount');
      }

      return list;
    }, [
      hasBase,
      hasPeak,
      hasDiscount,
    ]);

  const base = {
    start: baseStart,
    end: baseEnd,
  };

  const peak = {
    start: peakStart,
    end: peakEnd,
  };

  const discount = {
    start: discountStart,
    end: discountEnd,
  };

  const segmentValues: Record<
    SegmentType,
    {
      start: SharedValue<number>;
      end: SharedValue<number>;
    }
  > = {
    base,
    peak,
    discount,
  };

  const baseOthers =
    enabledSegments
      .filter(
        (k) => k !== 'base',
      )
      .map(
        (k) =>
          segmentValues[k],
      );

  const peakOthers =
    enabledSegments
      .filter(
        (k) => k !== 'peak',
      )
      .map(
        (k) =>
          segmentValues[k],
      );

  const discountOthers =
    enabledSegments
      .filter(
        (k) => k !== 'discount',
      )
      .map(
        (k) =>
          segmentValues[k],
      );

  const baseStartPan =
    useMemo(
      () =>
        makeHandleGesture(
          'base',
          base,
          baseOthers,
          'start',
        ),
      [baseOthers],
    );

  const baseEndPan =
    useMemo(
      () =>
        makeHandleGesture(
          'base',
          base,
          baseOthers,
          'end',
        ),
      [baseOthers],
    );

  const peakStartPan =
    useMemo(
      () =>
        makeHandleGesture(
          'peak',
          peak,
          peakOthers,
          'start',
        ),
      [peakOthers],
    );

  const peakEndPan =
    useMemo(
      () =>
        makeHandleGesture(
          'peak',
          peak,
          peakOthers,
          'end',
        ),
      [peakOthers],
    );

  const discountStartPan =
    useMemo(
      () =>
        makeHandleGesture(
          'discount',
          discount,
          discountOthers,
          'start',
        ),
      [discountOthers],
    );

  const discountEndPan =
    useMemo(
      () =>
        makeHandleGesture(
          'discount',
          discount,
          discountOthers,
          'end',
        ),
      [discountOthers],
    );

  const deleteSegment =
    useCallback(
      (key: SegmentType) => {
        if (key === 'base') {
          return;
        }

        const next = {
          ...schedule,
          [key]: {
            startHour: 0,
            endHour: 0,
          },
        };

        if (
          key === 'peak'
        ) {
          peakOpacity.value =
            withTiming(
              0,
              {
                duration: 250,
                easing:
                  Easing.out(
                    Easing.quad,
                  ),
              },
            );

          peakStart.value = 0;
          peakEnd.value = 0;
        }

        if (
          key === 'discount'
        ) {
          discountOpacity.value =
            withTiming(
              0,
              {
                duration: 250,
                easing:
                  Easing.out(
                    Easing.quad,
                  ),
              },
            );

          discountStart.value = 0;
          discountEnd.value = 0;
        }

        setSchedule(next);
        onChange?.(next);
      },
      [
        schedule,
        onChange,
        peakStart,
        peakEnd,
        discountStart,
        discountEnd,
        peakOpacity,
        discountOpacity,
      ],
    );

  const peakStartGesture =
    Gesture.Race(
      Gesture.LongPress()
        .minDuration(600)
        .maxDistance(20)
        .onStart(() => {
          runOnJS(deleteSegment)(
            'peak',
          );
        }),
      peakStartPan,
    );

  const peakEndGesture =
    Gesture.Race(
      Gesture.LongPress()
        .minDuration(600)
        .maxDistance(20)
        .onStart(() => {
          runOnJS(deleteSegment)(
            'peak',
          );
        }),
      peakEndPan,
    );

  const discountStartGesture =
    Gesture.Race(
      Gesture.LongPress()
        .minDuration(600)
        .maxDistance(20)
        .onStart(() => {
          runOnJS(deleteSegment)(
            'discount',
          );
        }),
      discountStartPan,
    );

  const discountEndGesture =
    Gesture.Race(
      Gesture.LongPress()
        .minDuration(600)
        .maxDistance(20)
        .onStart(() => {
          runOnJS(deleteSegment)(
            'discount',
          );
        }),
      discountEndPan,
    );

  const baseStartGesture =
    baseStartPan;

  const baseEndGesture =
    baseEndPan;

  const baseArcProps =
    useAnimatedProps(
      () => ({
        d: describeDonutArc(
          cx,
          cy,
          innerR,
          outerR,
          baseStart.value,
          baseEnd.value === HOURS
            ? HOURS -
                baseStart.value
            : forwardSpan(
                baseStart.value,
                baseEnd.value,
              ),
        ),
      }),
    );

  const peakArcProps =
    useAnimatedProps(
      () => ({
        d: describeDonutArc(
          cx,
          cy,
          innerR,
          outerR,
          peakStart.value,
          forwardSpan(
            peakStart.value,
            peakEnd.value,
          ),
        ),
        opacity: peakOpacity.value,
      }),
    );

  const discountArcProps =
    useAnimatedProps(
      () => ({
        d: describeDonutArc(
          cx,
          cy,
          innerR,
          outerR,
          discountStart.value,
          forwardSpan(
            discountStart.value,
            discountEnd.value,
          ),
        ),
        opacity: discountOpacity.value,
      }),
    );

  function useHandlePositionStyle(
      hourValue: SharedValue<number>,
    ) {
      return useAnimatedStyle(
        () => {
          const p =
            polarToCartesian(
              cx,
              cy,
              handleRadius,
              hourToAngle(
                hourValue.value,
              ),
            );

          return {
            top: 0,
            left: 0,
            transform: [
              {
                translateX:
                  p.x -
                  HANDLE_TOUCH_SIZE /
                    2,
              },
              {
                translateY:
                  p.y -
                  HANDLE_TOUCH_SIZE /
                    2,
              },
            ],
          };
        },
      );
    };

  const baseStartStyle =
    useHandlePositionStyle(
      baseStart,
    );

  const baseEndStyle =
    useHandlePositionStyle(
      baseEnd,
    );

  const peakStartStyle =
    useHandlePositionStyle(
      peakStart,
    );

  const peakEndStyle =
    useHandlePositionStyle(
      peakEnd,
    );

  const discountStartStyle =
    useHandlePositionStyle(
      discountStart,
    );

  const discountEndStyle =
    useHandlePositionStyle(
      discountEnd,
    );

  const ticks = useMemo(
    () => {
      const items: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        label?: string;
        lx: number;
        ly: number;
      }[] = [];

      for (
        let h = 0;
        h < HOURS;
        h++
      ) {
        const angle =
          hourToAngle(h);

        const outer =
          polarToCartesian(
            cx,
            cy,
            outerR + 6,
            angle,
          );

        const inner =
          polarToCartesian(
            cx,
            cy,
            outerR +
              (h % 3 === 0
                ? 16
                : 10),
            angle,
          );

        const labelPos =
          polarToCartesian(
            cx,
            cy,
            outerR + 27,
            angle,
          );

        items.push({
          x1: outer.x,
          y1: outer.y,
          x2: inner.x,
          y2: inner.y,
          label:
            h % 3 === 0
              ? String(h)
              : undefined,
          lx: labelPos.x,
          ly: labelPos.y,
        });
      }

      return items;
    },
    [
      cx,
      cy,
      outerR,
    ],
  );

  const zeroLine = useMemo(() => {
    const angle = hourToAngle(0);

    const outer = polarToCartesian(
      cx,
      cy,
      outerR,
      angle,
    );

    const inner = polarToCartesian(
      cx,
      cy,
      innerR,
      angle,
    );

    return {
      x1: outer.x,
      y1: outer.y,
      x2: inner.x,
      y2: inner.y,
    };
  }, [
    cx,
    cy,
    innerR,
    outerR,
  ]);

  const isDiscountActive =
    hasDiscount &&
    schedule.discount
      .startHour !==
      schedule.discount.endHour;

  const isPeakActive =
    hasPeak &&
    schedule.peak.startHour !==
      schedule.peak.endHour;

  const handleAddHours =
    useCallback(
      (key: SegmentType) => {
        const activeOtherRanges =
          SEGMENT_ORDER
            .filter(
              (k) =>
                k !== key &&
                enabledSegments.includes(
                  k,
                ) &&
                segmentDuration(
                  schedule[k],
                ) > 0,
            )
            .map(
              (k) =>
                schedule[k],
            );

        let freeStart = -1;

        for (
          let h = 0;
          h < HOURS;
          h++
        ) {
          const nextH =
            (h + 1) % HOURS;

          const isFree1 =
            !activeOtherRanges.some(
              (r) =>
                forwardSpan(
                  r.startHour,
                  h,
                ) <
                segmentDuration(r),
            );

          const isFree2 =
            !activeOtherRanges.some(
              (r) =>
                forwardSpan(
                  r.startHour,
                  nextH,
                ) <
                segmentDuration(r),
            );

          if (isFree1 && isFree2) {
            freeStart = h;
            break;
          }
        }

        let start: number;
        let end: number;

        if (freeStart !== -1) {
          start = freeStart;
          end = (freeStart + 2) %HOURS;
        } else {
          if (key === 'peak') {
            start = schedule.base.endHour - 2;
            end = schedule.base.endHour;

            const newBaseEnd = start;
            baseEnd.value = newBaseEnd;

            updateSegment('base', schedule.base.startHour, newBaseEnd);
          } else {
            start = schedule.base.startHour;
            end = schedule.base.startHour + 2;

            const newBaseStart = end;
            baseStart.value = newBaseStart;

            updateSegment('base', newBaseStart, schedule.base.endHour);
          }
        }

        if (key === 'peak') {
          peakStart.value =
            start;

          peakEnd.value =
            end;

          peakOpacity.value =
            withTiming(1,
              {
                duration: 250,
                easing:
                  Easing.out(
                    Easing.quad,
                  ),
              },
            );

          updateSegment('peak', start, end);
        } else if (
          key === 'discount'
        ) {
          discountStart.value =
            start;

          discountEnd.value =
            end;

          discountOpacity.value =
            withTiming(
              1,
              {
                duration: 250,
                easing:
                  Easing.out(
                    Easing.quad,
                  ),
              },
            );

          updateSegment(
            'discount',
            start,
            end,
          );
        }
      },
      [
        schedule,
        enabledSegments,
        updateSegment,
        baseStart,
        baseEnd,
        peakStart,
        peakEnd,
        discountStart,
        discountEnd,
        peakOpacity,
        discountOpacity,
      ],
    );

  const assignedHours =
    enabledSegments.reduce(
      (sum, key) => {
        return (
          sum +
          segmentDuration(
            schedule[key],
          )
        );
      },
      0,
    );

  const unassignedHours =
    Math.max(
      0,
      HOURS -
        assignedHours,
    );

  return (
    <View className="items-center">
      <Animated.View
        ref={containerRef}
        collapsable={false}
        style={{
          width: size,
          height: size,
        }}
      >
        <Svg
          width={size}
          height={size}
        >
          <Defs>
            <LinearGradient
              id="baseGradient"
              x1="0"
              y1="0"
              x2={size}
              y2={size}
              gradientUnits="userSpaceOnUse"
            >
              <Stop
                offset="0"
                stopColor={
                  GRADIENT_STOPS.base[0]
                }
              />
              <Stop
                offset="1"
                stopColor={
                  GRADIENT_STOPS.base[1]
                }
              />
            </LinearGradient>
            <LinearGradient
              id="peakGradient"
              x1="0"
              y1="0"
              x2={size}
              y2={size}
              gradientUnits="userSpaceOnUse"
            >
              <Stop
                offset="0"
                stopColor={
                  GRADIENT_STOPS.peak[0]
                }
              />
              <Stop
                offset="1"
                stopColor={
                  GRADIENT_STOPS.peak[1]
                }
              />
            </LinearGradient>
            <LinearGradient
              id="discountGradient"
              x1="0"
              y1="0"
              x2={size}
              y2={size}
              gradientUnits="userSpaceOnUse"
            >
              <Stop
                offset="0"
                stopColor={
                  GRADIENT_STOPS.discount[0]
                }
              />
              <Stop
                offset="1"
                stopColor={
                  GRADIENT_STOPS.discount[1]
                }
              />
            </LinearGradient>
          </Defs>
          <Circle
            cx={cx}
            cy={cy}
            r={
              (innerR + outerR) /
              2
            }
            stroke={GAP_COLOR}
            strokeWidth={
              outerR - innerR
            }
            fill="none"
          />
          <Path
            d={`M ${zeroLine.x1} ${zeroLine.y1} L ${zeroLine.x2} ${zeroLine.y2}`}
            stroke={ZERO_LINE_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={outerR + 1}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth={1}
          />
          <AnimatedPath
            animatedProps={
              discountArcProps
            }
            fill="url(#discountGradient)"
          />
          <AnimatedPath
            animatedProps={
              baseArcProps
            }
            fill="url(#baseGradient)"
          />
          <AnimatedPath
            animatedProps={
              peakArcProps
            }
            fill="url(#peakGradient)"
          />
          {
            ticks.map(
              (t, i) => (
                <Path
                  key={i}
                  d={`M ${t.x1} ${t.y1} L ${t.x2} ${t.y2}`}
                  stroke="#999999"
                  strokeWidth={1.5}
                />
              ),
            )
          }
        </Svg>
        {
          ticks
            .filter(
              (t) =>
                t.label !==
                undefined,
            )
            .map(
              (t, i) => (
                <Text
                  key={i}
                  className="absolute w-5 text-center text-[11px] text-neutral-500"
                  style={{
                    left: t.lx - 10,
                    top: t.ly - 8,
                  }}
                >
                  {t.label}
                </Text>
              ),
            )
        }
        {
          isDiscountActive && (
            <>
              <GestureDetector
                gesture={
                  discountStartGesture
                }
              >
                <Animated.View
                  className="absolute h-11 w-11 items-center justify-center"
                  style={
                    discountStartStyle
                  }
                >
                  <HandleThumb
                    type="discount"
                  />
                </Animated.View>
              </GestureDetector>

              <GestureDetector
                gesture={
                  discountEndGesture
                }
              >
                <Animated.View
                  className="absolute h-11 w-11 items-center justify-center"
                  style={
                    discountEndStyle
                  }
                >
                  <HandleThumb
                    type="discount"
                  />
                </Animated.View>
              </GestureDetector>
            </>
          )
        }
        {
          hasBase && (
            <>
              <GestureDetector
                gesture={
                  baseStartGesture
                }
              >
                <Animated.View
                  className="absolute h-11 w-11 items-center justify-center"
                  style={
                    baseStartStyle
                  }
                >
                  <HandleThumb
                    type="base"
                  />
                </Animated.View>
              </GestureDetector>

              <GestureDetector
                gesture={
                  baseEndGesture
                }
              >
                <Animated.View
                  className="absolute h-11 w-11 items-center justify-center"
                  style={
                    baseEndStyle
                  }
                >
                  <HandleThumb
                    type="base"
                  />
                </Animated.View>
              </GestureDetector>
            </>
          )
        }
        {
          isPeakActive && (
            <>
              <GestureDetector
                gesture={
                  peakStartGesture
                }
              >
                <Animated.View
                  className="absolute h-11 w-11 items-center justify-center"
                  style={
                    peakStartStyle
                  }
                >
                  <HandleThumb
                    type="peak"
                  />
                </Animated.View>
              </GestureDetector>

              <GestureDetector
                gesture={
                  peakEndGesture
                }
              >
                <Animated.View
                  className="absolute h-11 w-11 items-center justify-center"
                  style={
                    peakEndStyle
                  }
                >
                  <HandleThumb
                    type="peak"
                  />
                </Animated.View>
              </GestureDetector>
            </>
          )
        }
      </Animated.View>
      <View className="mt-8 w-full gap-y-2">
        {SEGMENT_ORDER
          .filter(
            (type) =>
              enabledSegments.includes(
                type,
              ),
          )
          .map(
            (type) => {
              const r =
                schedule[type];

              const hasZeroDuration =
                segmentDuration(r) ===
                0;

              return (
                <View
                  key={type}
                  className="flex-row items-center py-1.5"
                >
                  <View
                    className={`mr-2.5 size-2 rounded-full ${DOT_CLASS[type]}`}
                  />

                  <Text
                    className={`flex-1 ${TEXT_CLASS[type]}`}
                  >
                    {LABELS[type]}
                  </Text>

                  {hasZeroDuration ? (
                    <Pressable
                      onPress={() =>
                        handleAddHours(
                          type,
                        )
                      }
                      className="flex-row items-center gap-x-1"
                    >
                      <IconPlus
                        width={14}
                        height={14}
                        color="#6b7280"
                      />

                      <Text className="text-gray-500">
                        Add
                      </Text>
                    </Pressable>
                  ) : (
                    <Text>
                      {formatHour(
                        r.startHour,
                      )}{' '}
                      –{' '}
                      {formatHour(
                        r.endHour,
                      )}
                    </Text>
                  )}
                </View>
              );
            },
          )}
        <View className="flex-row items-center py-1.5">
          <View className="mr-2.5 size-2 rounded-full bg-gray-200" />
          <Text className="flex-1 text-gray-500">
            Unassigned
          </Text>
          <Text>
            {unassignedHours > 1 &&
              `${unassignedHours} Hours`}

            {unassignedHours === 1 &&
              `${unassignedHours} Hour`}

            {unassignedHours <= 0 &&
              `None`}
          </Text>
        </View>
      </View>
    </View>
  );
};
