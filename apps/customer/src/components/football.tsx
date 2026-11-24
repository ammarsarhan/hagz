import { useId } from "react";
import { Circle, ClipPath, Defs, G, Line, Path } from "react-native-svg";

// A football for the illustrations (user, 2026-11-23: "a football", not a lone pentagon): a black
// pentagon in the middle, seams out to the black patches cut off at the edge, the outline over
// them. Drawn inside an Svg, centred on (x, y).

const BLACK = "#000000";
const WHITE = "#FFFFFF";

const pentagon = (cx: number, cy: number, radius: number, turn: number) =>
  Array.from({ length: 5 }, (_, i) => {
    const angle = ((turn + i * 72) * Math.PI) / 180;
    const px = (cx + radius * Math.cos(angle)).toFixed(2);
    const py = (cy + radius * Math.sin(angle)).toFixed(2);
    return `${i === 0 ? "M" : "L"}${px} ${py}`;
  }).join(" ") + "Z";

export function Football({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  // useId gives ":r1:"; colons don't belong in an SVG url(#…).
  const clip = `ball${useId().replace(/:/g, "")}`;
  const middle = r * 0.36;
  const patch = r * 0.34;
  const out = r * 0.96;
  const along = (angle: number, distance: number) => {
    const radians = (angle * Math.PI) / 180;
    return [x + distance * Math.cos(radians), y + distance * Math.sin(radians)] as const;
  };
  return (
    <>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={x} cy={y} r={r} />
        </ClipPath>
      </Defs>
      <Circle cx={x} cy={y} r={r} fill={WHITE} />
      <G clipPath={`url(#${clip})`}>
        <Path d={pentagon(x, y, middle, -90)} fill={BLACK} />
        {[0, 1, 2, 3, 4].map((k) => {
          const angle = -90 + k * 72;
          const [x1, y1] = along(angle, middle);
          const [x2, y2] = along(angle, out - patch);
          const [px, py] = along(angle, out);
          return (
            <G key={k}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLACK} strokeWidth={r * 0.11} />
              <Path d={pentagon(px, py, patch, angle + 180)} fill={BLACK} />
            </G>
          );
        })}
      </G>
      <Circle cx={x} cy={y} r={r - 1.5} fill="none" stroke={BLACK} strokeWidth={3} />
    </>
  );
}
