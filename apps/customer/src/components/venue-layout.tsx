import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import type { PublicGround, PublicVenue } from "@/lib/venue";

// A venue's map, read only: the owner's grid at a cell to every `width / columns` points, drawn
// without its lines or an outline (user, 2026-11-22: the grid broken up by the tiles looked bad);
// the grey card is the venue. Each ground is drawn top-down with its markings and name, the
// amenities placed on it as white tiles, and the entrances as black tags on the edge. Grounds under maintenance say so, and so do grounds that don't fit the search the page
// came from (faded, "Unavailable"). With `onPressGround` (the layout screen,
// app/venue/[slug]/layout.tsx), each open ground is a button over its tile that goes dark grey while
// held. It's the real place seen from above, so it isn't mirrored in Arabic.

type Layout = NonNullable<PublicVenue["layout"]>;

const INK = "#0b0b0c";
const TILE = "#e4e6ea";
const MARK = "#9ea3ab";
// A held ground: a grey darker than the rest, its lines darker too.
const HELD = "#c9cdd3";
const HELD_MARK = "#6f747c";
const AMENITY_LINE = "#d5d8dd";
const UNIT = "#737373";
// Inside a cell's edge, so tiles side by side don't touch.
const INSET = 2;
// Pitch markings start this far inside the tile.
const MARGIN = 5;
// Room around the outline for the entrance tags that sit across it.
const EDGE = 8;
// The card's padding (p-3), between its edge and the drawing.
const PAD = 12;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The lines of a ground, along the tile's long side.
function Markings({
  sport,
  box,
  color,
}: {
  sport: PublicGround["sport"];
  box: Box;
  color: string;
}) {
  const { x, y, w, h } = {
    x: box.x + MARGIN,
    y: box.y + MARGIN,
    w: box.w - 2 * MARGIN,
    h: box.h - 2 * MARGIN,
  };
  const across = w >= h;
  // In "across" terms: length runs along the long side.
  const mid = across
    ? { x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + h }
    : { x1: x, y1: y + h / 2, x2: x + w, y2: y + h / 2 };
  const short = Math.min(w, h);
  const lines: ReactNode[] = [
    <Rect
      key="edge"
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      fill="none"
      stroke={color}
      strokeWidth={1.2}
    />,
  ];
  if (sport === "FOOTBALL" || sport === "BASKETBALL") {
    lines.push(<Line key="half" {...mid} stroke={color} strokeWidth={1.2} />);
    lines.push(
      <Circle
        key="centre"
        cx={x + w / 2}
        cy={y + h / 2}
        r={Math.min(short * 0.2, 14)}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
      />,
    );
    // Penalty boxes or keys at both ends.
    const depth = (across ? w : h) * 0.11;
    const span = short * 0.5;
    const ends = across
      ? [
          { x, y: y + (h - span) / 2, width: depth, height: span },
          { x: x + w - depth, y: y + (h - span) / 2, width: depth, height: span },
        ]
      : [
          { x: x + (w - span) / 2, y, width: span, height: depth },
          { x: x + (w - span) / 2, y: y + h - depth, width: span, height: depth },
        ];
    ends.forEach((end, i) =>
      lines.push(<Rect key={`end${i}`} {...end} fill="none" stroke={color} strokeWidth={1.2} />),
    );
  } else {
    // A net across the middle, and service lines either side of it.
    lines.push(<Line key="net" {...mid} stroke={color} strokeWidth={2.2} />);
    for (const k of [0.3, 0.7]) {
      lines.push(
        across ? (
          <Line
            key={k}
            x1={x + w * k}
            y1={y}
            x2={x + w * k}
            y2={y + h}
            stroke={color}
            strokeWidth={1.2}
          />
        ) : (
          <Line
            key={k}
            x1={x}
            y1={y + h * k}
            x2={x + w}
            y2={y + h * k}
            stroke={color}
            strokeWidth={1.2}
          />
        ),
      );
    }
  }
  return <G>{lines}</G>;
}

const AnimatedG = Animated.createAnimatedComponent(G);

// The held look laid over a ground (darker grey, darker lines), fading in and out rather than the
// colours snapping.
function HeldOverlay({
  sport,
  box,
  held,
}: {
  sport: PublicGround["sport"];
  box: Box;
  held: boolean;
}) {
  const shown = useSharedValue(held ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(held ? 1 : 0, { duration: 200 });
  }, [held, shown]);
  const props = useAnimatedProps(() => ({ opacity: shown.value }));
  return (
    <AnimatedG animatedProps={props}>
      <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill={HELD} />
      <Markings sport={sport} box={box} color={HELD_MARK} />
    </AnimatedG>
  );
}

// A white pill with the ground's name in the middle of its tile; the status is dropped when the
// tile is too small for both.
function Tag({ box, name, status }: { box: Box; name: string; status?: string }) {
  const full = status ? `${name} · ${status}` : name;
  const widthOf = (text: string) => text.length * 6.2 + 14;
  const text = widthOf(full) <= box.w - 6 ? full : name;
  const width = Math.min(widthOf(text), box.w - 4);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return (
    <G>
      <Rect x={cx - width / 2} y={cy - 9} width={width} height={18} rx={9} fill="#ffffff" />
      <SvgText x={cx} y={cy + 3.8} textAnchor="middle" fontSize={10.5} fontWeight="600" fill={INK}>
        {text}
      </SvgText>
    </G>
  );
}

export function VenueLayout({
  layout,
  grounds,
  amenities,
  unavailableIds,
  onPressGround,
}: {
  layout: Layout;
  grounds: PublicGround[];
  amenities: PublicVenue["amenities"];
  // Grounds that don't fit the search the page came from: faded, tagged Unavailable.
  unavailableIds?: ReadonlySet<string>;
  // Tapping an open ground (not one closed for maintenance).
  onPressGround?: (groundId: string) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  // The ground under a finger.
  const [heldId, setHeldId] = useState<string | null>(null);
  const cell = width / layout.columns;
  const height = cell * layout.rows;
  const groundById = new Map(grounds.map((ground) => [ground.id, ground]));
  const amenityById = new Map(amenities.map((amenity) => [amenity.id, amenity]));
  const boxOf = (x: number, y: number, w: number, h: number): Box => ({
    x: x * cell + INSET,
    y: y * cell + INSET,
    w: w * cell - 2 * INSET,
    h: h * cell - 2 * INSET,
  });

  return (
    <View
      className="overflow-hidden rounded-2xl bg-[#f6f7f8] p-3"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 2 * PAD - 2 * EDGE)}
    >
      {width > 0 ? (
        <Svg width={width + 2 * EDGE} height={height + 2 * EDGE}>
          <G transform={`translate(${EDGE}, ${EDGE})`}>
            {layout.amenities.map((tile, i) => {
              const box = boxOf(tile.x, tile.y, tile.width, tile.height);
              const name = amenityById.get(tile.optionId)?.name ?? "";
              return (
                <G key={`a${i}`}>
                  <Rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={4}
                    fill="#ffffff"
                    stroke={AMENITY_LINE}
                    strokeWidth={1}
                  />
                  {name.length * 5.6 < box.w - 6 ? (
                    <SvgText
                      x={box.x + box.w / 2}
                      y={box.y + box.h / 2 + 3.5}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="500"
                      fill={UNIT}
                    >
                      {name}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}

            {layout.grounds.map((placed) => {
              const ground = groundById.get(placed.groundId);
              if (!ground) return null;
              const [w, h] =
                placed.orientation === "VERTICAL"
                  ? [placed.height, placed.width]
                  : [placed.width, placed.height];
              const box = boxOf(placed.x, placed.y, w, h);
              const held = ground.id === heldId;
              const unavailable = unavailableIds?.has(ground.id) === true;
              return (
                <G key={placed.groundId} opacity={unavailable ? 0.45 : 1}>
                  <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill={TILE} />
                  <Markings sport={ground.sport} box={box} color={MARK} />
                  <HeldOverlay sport={ground.sport} box={box} held={held} />
                  <Tag
                    box={box}
                    name={ground.name ?? ""}
                    status={
                      ground.status === "MAINTENANCE"
                        ? t("components.venueLayout.closed")
                        : unavailable
                          ? t("screens.venue.filter.unavailable")
                          : undefined
                    }
                  />
                </G>
              );
            })}

            {layout.entrances.map((entrance, i) => {
              const along = (entrance.offset + 0.5) * cell;
              const horizontal = entrance.side === "TOP" || entrance.side === "BOTTOM";
              const cx = horizontal ? along : entrance.side === "LEFT" ? 0 : width;
              const cy = horizontal ? (entrance.side === "TOP" ? 0 : height) : along;
              const w = horizontal ? 58 : 16;
              const h = horizontal ? 16 : 58;
              return (
                <G key={`e${i}`}>
                  <Rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={8} fill={INK} />
                  {horizontal ? (
                    <SvgText
                      x={cx}
                      y={cy + 3.5}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight="600"
                      fill="#ffffff"
                    >
                      Entrance
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </G>
        </Svg>
      ) : (
        <View style={{ aspectRatio: layout.columns / layout.rows }} />
      )}
      {/* The buttons, one over each open ground's tile (an SVG shape can't be a button a screen
          reader finds). */}
      {onPressGround && width > 0
        ? layout.grounds.map((placed) => {
            const ground = groundById.get(placed.groundId);
            if (!ground || ground.status !== "ACTIVE") return null;
            const [w, h] =
              placed.orientation === "VERTICAL"
                ? [placed.height, placed.width]
                : [placed.width, placed.height];
            const box = boxOf(placed.x, placed.y, w, h);
            return (
              <Pressable
                key={placed.groundId}
                accessibilityRole="button"
                accessibilityLabel={t("screens.venue.grounds.seeTimesFor", {
                  name: ground.name ?? "",
                })}
                onPressIn={() => setHeldId(ground.id)}
                onPressOut={() => setHeldId(null)}
                onPress={() => onPressGround(ground.id)}
                style={{
                  position: "absolute",
                  left: PAD + EDGE + box.x,
                  top: PAD + EDGE + box.y,
                  width: box.w,
                  height: box.h,
                }}
              />
            );
          })
        : null}
    </View>
  );
}
