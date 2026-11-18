import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";

// A burst of confetti falling over the whole screen once, for a moment worth marking (a venue
// approved), after Google's on celebration searches: pieces start just above the top edge across
// the width, fall at slightly different speeds, sway side to side and flip as they go. Drawn with
// Reanimated on the UI thread, so it never holds up the screen under it, and it takes no touches.
// Staff app colours only (the blues and ink), no rainbow. Nothing at all with Reduce Motion on.

const PIECES = 80;
// The brand's soft blue (blue-soft in @hagz/brand), only here, so not in colors.
const SOFT_BLUE = "#a0bcff";
const PALETTE = [colors.primary, colors.primary, colors.primarySoft, SOFT_BLUE, colors.ink];

interface Piece {
  x: number;
  // Where it starts above the top edge, so they don't arrive as one line.
  lift: number;
  width: number;
  height: number;
  color: string;
  round: boolean;
  delay: number;
  duration: number;
  sway: number;
  swaySpeed: number;
  spin: number;
  flipSpeed: number;
}

// A seeded generator, so a re-render doesn't reshuffle pieces mid-fall.
const random = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const makePieces = (width: number): Piece[] => {
  const next = random(20261118);
  const between = (min: number, max: number) => min + next() * (max - min);
  return Array.from({ length: PIECES }, () => {
    const round = next() < 0.2;
    const size = between(6, 10);
    return {
      x: between(0, width),
      lift: between(10, 120),
      width: round ? size : size * 0.6,
      height: round ? size : size * 1.6,
      color: PALETTE[Math.floor(next() * PALETTE.length)] ?? colors.primary,
      round,
      delay: between(0, 500),
      duration: between(2400, 3600),
      sway: between(12, 36),
      swaySpeed: between(2, 4),
      spin: between(-540, 540),
      flipSpeed: between(3, 7),
    };
  });
};

export function Confetti({ onDone }: { onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const pieces = useMemo(() => makePieces(width), [width]);
  // 0 → 1 over the longest piece's fall; each piece maps its own share of it.
  const progress = useSharedValue(0);
  const total = Math.max(...pieces.map((piece) => piece.delay + piece.duration));
  // The latest onDone, so a parent's new function each render doesn't restart the fall.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const finish = () => done.current?.();
    if (reduceMotion) return finish();
    progress.value = withTiming(1, { duration: total, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [reduceMotion, progress, total]);

  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={index} piece={piece} progress={progress} total={total} fall={height} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  piece,
  progress,
  total,
  fall,
}: {
  piece: Piece;
  progress: SharedValue<number>;
  total: number;
  fall: number;
}) {
  const style = useAnimatedStyle(() => {
    // This piece's own 0 → 1, from its delay to the end of its fall.
    const elapsed = progress.value * total - piece.delay;
    const t = Math.min(Math.max(elapsed / piece.duration, 0), 1);
    // Quick off the top, easing a little as it drifts down, like paper.
    const eased = 1 - Math.pow(1 - t, 1.6);
    const y = -piece.lift + eased * (fall + piece.lift + 40);
    const x = Math.sin(t * Math.PI * piece.swaySpeed) * piece.sway;
    return {
      opacity: t === 0 ? 0 : t > 0.85 ? (1 - t) / 0.15 : 1,
      transform: [
        { translateX: piece.x + x },
        { translateY: y },
        { rotateZ: `${t * piece.spin}deg` },
        // The flip: squashing one side reads as the piece turning over in the air.
        { scaleY: piece.round ? 1 : Math.cos(t * Math.PI * piece.flipSpeed) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: piece.width,
          height: piece.height,
          borderRadius: piece.round ? piece.width / 2 : 1.5,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}
