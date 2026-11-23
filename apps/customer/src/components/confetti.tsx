import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

// Confetti over a screen, once, for a player's first booking (user, 2026-11-24). Plain Reanimated
// views, so no native module and no new development build: each piece falls from above the screen
// with its own sway, spin and pace, then it's gone. Not drawn at all with Reduce Motion on.

const PIECES = 90;
// The customer palette: lime, ink, the blues, a grey.
const COLORS = ["#E9FEA0", "#0b0b0c", "#1F38ED", "#A0BCFF", "#527CF7", "#c4c8cf"];

interface Piece {
  x: number;
  drift: number;
  size: number;
  long: boolean;
  round: boolean;
  color: string;
  delay: number;
  duration: number;
  spin: number;
}

const random = (from: number, to: number) => from + Math.random() * (to - from);

export function Confetti() {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        x: random(0, width),
        drift: random(-60, 60),
        size: random(6, 10),
        long: Math.random() < 0.6,
        round: Math.random() < 0.25,
        color: COLORS[index % COLORS.length] ?? "#E9FEA0",
        delay: random(0, 700),
        duration: random(2200, 3400),
        spin: random(-720, 720),
      })),
    [width],
  );
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <Falling key={index} piece={piece} height={height} />
      ))}
    </View>
  );
}

function Falling({ piece, height }: { piece: Piece; height: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, {
        duration: piece.duration,
        easing: Easing.in(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [piece, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 || p > 0.92 ? (p === 0 ? 0 : (1 - p) / 0.08) : 1,
      transform: [
        { translateX: piece.x + piece.drift * Math.sin(p * Math.PI * 2) },
        { translateY: -24 + p * (height + 48) },
        { rotate: `${piece.spin * p}deg` },
        { rotateX: `${p * 540}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          width: piece.size,
          height: piece.long ? piece.size * 1.6 : piece.size,
          borderRadius: piece.round ? piece.size : 1.5,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}
