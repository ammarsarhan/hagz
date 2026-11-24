import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AmenityIcon } from "./amenity-icon";
import { Text } from "./text";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import type { PublicGround, PublicVenue } from "@/lib/venue";

// A venue's map (the layout screen, app/venue/[slug]/layout.tsx; Figma C5 215:2, round 2): the
// part of the owner's grid with something on it (windowOf), fitted to the width, a cell at most
// MAX_CELL points, its lines very faint and under
// everything (user, 2026-11-22: drawn plainly, the grid broken up by the tiles looked bad; brought
// back faint the same day), with no outline; the grey card is the venue, its
// entrances black tags across its edge. Each ground is drawn top-down with its markings and name; the
// amenities are white tiles, faded, as they can't be tapped. Grounds under maintenance say so, and so
// do grounds that don't fit the search the page came from (faded, "Unavailable"). The picked ground is
// a darker grey; tapping a ground picks it. It's the real place seen from above, so it isn't mirrored
// in Arabic.

type Layout = NonNullable<PublicVenue["layout"]>;

const INK = "#0b0b0c";
// The grid: barely darker than the card (#f6f7f8), hairline thin.
const GRID = "#e8eaed";
const GRID_WIDTH = 0.5;
const TILE = "#e4e6ea";
const MARK = "#9ea3ab";
// The picked ground: a grey darker than the rest, its lines darker too.
const PICKED = "#c9cdd3";
const PICKED_MARK = "#6f747c";
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
// The biggest a cell draws: a venue with a couple of small courts stays a map, not giant blocks.
const MAX_CELL = 44;
// Room kept around what's drawn, in cells (the walkway the owner's grid has round its tiles).
const MARGIN_CELLS = 1;

interface Window {
  left: number;
  top: number;
  columns: number;
  rows: number;
}

// The part of the owner's grid worth drawing (user, 2026-11-24: venues whose grounds sit in a
// corner of a wide grid came out tiny): the box round every tile, a cell of walkway round it,
// inside the grid. The screen fits this, not the grid.
const windowOf = (layout: Layout): Window => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const placed of layout.grounds) {
    const [w, h] =
      placed.orientation === "VERTICAL"
        ? [placed.height, placed.width]
        : [placed.width, placed.height];
    xs.push(placed.x, placed.x + w);
    ys.push(placed.y, placed.y + h);
  }
  for (const tile of layout.amenities) {
    xs.push(tile.x, tile.x + tile.width);
    ys.push(tile.y, tile.y + tile.height);
  }
  // Entrances don't widen it: one far along an empty edge would keep the empty grid. They're drawn
  // on the window's edge, one past its end at that end (still on the right side of everything).
  if (xs.length === 0) return { left: 0, top: 0, columns: layout.columns, rows: layout.rows };
  const left = Math.max(0, Math.min(...xs) - MARGIN_CELLS);
  const top = Math.max(0, Math.min(...ys) - MARGIN_CELLS);
  const right = Math.min(layout.columns, Math.max(...xs) + MARGIN_CELLS);
  const bottom = Math.min(layout.rows, Math.max(...ys) + MARGIN_CELLS);
  return { left, top, columns: right - left, rows: bottom - top };
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Whether an amenity's name fits across its tile (10 pt, about 5.6 a letter).
const fitsName = (name: string, box: Box) => name.length * 5.6 < box.w - 6;

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

// The picked look laid over a ground (darker grey, darker lines), fading in and out as the pick
// moves, rather than the colours snapping.
function PickedOverlay({
  sport,
  box,
  picked,
}: {
  sport: PublicGround["sport"];
  box: Box;
  picked: boolean;
}) {
  const shown = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(picked ? 1 : 0, { duration: 200 });
  }, [picked, shown]);
  const props = useAnimatedProps(() => ({ opacity: shown.value }));
  return (
    <AnimatedG animatedProps={props}>
      <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill={PICKED} />
      <Markings sport={sport} box={box} color={PICKED_MARK} />
    </AnimatedG>
  );
}

// A white pill with the ground's name in the middle of its tile; the status is dropped when the
// tile is too small for both. The pill is as wide as the name, so on a small tile (a padel court) it
// hangs over the walkway rather than the name spilling out of it.
function Tag({ box, name, status }: { box: Box; name: string; status?: string }) {
  const full = status ? `${name} · ${status}` : name;
  const widthOf = (text: string) => text.length * 6.2 + 14;
  const text = widthOf(full) <= box.w - 6 ? full : name;
  const width = widthOf(text);
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
  pickedId,
  onPick,
  maxHeight,
}: {
  layout: Layout;
  grounds: PublicGround[];
  amenities: PublicVenue["amenities"];
  // Grounds that don't fit the search the page came from: faded, tagged Unavailable.
  unavailableIds?: ReadonlySet<string>;
  // The ground picked here or in the cards under the map.
  pickedId: string | null;
  onPick: (groundId: string) => void;
  // As tall as this at most, card and all: the layout screen fits the map between its title and its
  // cards, so it never scrolls. Narrower then, and centred.
  maxHeight?: number;
}) {
  const { t } = useTranslation();
  // The width there is, and the drawing's cell: as wide as fits, unless that's too tall.
  const [room, setRoom] = useState(0);
  const around = 2 * (PAD + EDGE);
  const view = windowOf(layout);
  const cell =
    room > 0
      ? Math.min(
          MAX_CELL,
          (room - around) / view.columns,
          maxHeight === undefined ? Infinity : Math.max(0, maxHeight - around) / view.rows,
        )
      : 0;
  const width = cell * view.columns;
  const height = cell * view.rows;
  const groundById = new Map(grounds.map((ground) => [ground.id, ground]));
  const amenityById = new Map(amenities.map((amenity) => [amenity.id, amenity]));
  const boxOf = (x: number, y: number, w: number, h: number): Box => ({
    x: (x - view.left) * cell + INSET,
    y: (y - view.top) * cell + INSET,
    w: w * cell - 2 * INSET,
    h: h * cell - 2 * INSET,
  });

  return (
    <View onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      <View
        className="self-center rounded-[6px] bg-[#f6f7f8] p-3"
        style={room > 0 ? { width: width + around } : { alignSelf: "stretch" }}
      >
        {width > 0 ? (
          <Svg width={width + 2 * EDGE} height={height + 2 * EDGE}>
            <G transform={`translate(${EDGE}, ${EDGE})`}>
              {Array.from({ length: view.columns - 1 }, (_, i) => (
                <Line
                  key={`c${i}`}
                  x1={(i + 1) * cell}
                  y1={0}
                  x2={(i + 1) * cell}
                  y2={height}
                  stroke={GRID}
                  strokeWidth={GRID_WIDTH}
                />
              ))}
              {Array.from({ length: view.rows - 1 }, (_, i) => (
                <Line
                  key={`r${i}`}
                  x1={0}
                  y1={(i + 1) * cell}
                  x2={width}
                  y2={(i + 1) * cell}
                  stroke={GRID}
                  strokeWidth={GRID_WIDTH}
                />
              ))}

              {layout.amenities.map((tile, i) => {
                const box = boxOf(tile.x, tile.y, tile.width, tile.height);
                const name = amenityById.get(tile.optionId)?.name ?? "";
                return (
                  <G key={`a${i}`} opacity={0.5}>
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
                    {fitsName(name, box) ? (
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
                const picked = ground.id === pickedId;
                const unavailable = unavailableIds?.has(ground.id) === true;
                return (
                  <G key={placed.groundId} opacity={unavailable ? 0.45 : 1}>
                    <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill={TILE} />
                    <Markings sport={ground.sport} box={box} color={MARK} />
                    <PickedOverlay sport={ground.sport} box={box} picked={picked} />
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
            </G>
          </Svg>
        ) : (
          <View style={{ aspectRatio: view.columns / view.rows }} />
        )}
        {/* An amenity too small for its name shows its icon (an SVG can't hold the icon's own
            SVG), faded as its tile is. */}
        {width > 0
          ? layout.amenities.map((tile, i) => {
              const box = boxOf(tile.x, tile.y, tile.width, tile.height);
              const amenity = amenityById.get(tile.optionId);
              if (!amenity || fitsName(amenity.name ?? "", box)) return null;
              const size = Math.min(16, box.w - 6, box.h - 6);
              if (size < 8) return null;
              return (
                <View
                  key={`ai${i}`}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  className="items-center justify-center"
                  style={{
                    position: "absolute",
                    left: PAD + EDGE + box.x,
                    top: PAD + EDGE + box.y,
                    width: box.w,
                    height: box.h,
                    opacity: 0.5,
                  }}
                >
                  <AmenityIcon name={amenity.icon} size={size} color={UNIT} />
                </View>
              );
            })
          : null}
        {/* The buttons, one over each ground's tile (an SVG shape can't be a button a screen reader
          finds). */}
        {width > 0
          ? layout.grounds.map((placed) => {
              const ground = groundById.get(placed.groundId);
              if (!ground) return null;
              const [w, h] =
                placed.orientation === "VERTICAL"
                  ? [placed.height, placed.width]
                  : [placed.width, placed.height];
              const box = boxOf(placed.x, placed.y, w, h);
              return (
                <Pressable
                  key={placed.groundId}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ground.id === pickedId }}
                  accessibilityLabel={ground.name ?? ""}
                  onPress={() => onPick(ground.id)}
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
        {/* The entrances, across the card's own edge (half of each tag hangs outside it). */}
        {width > 0
          ? layout.entrances.map((entrance, i) => {
              const horizontal = entrance.side === "TOP" || entrance.side === "BOTTOM";
              const [start, span] = horizontal ? [view.left, view.columns] : [view.top, view.rows];
              const within = Math.min(Math.max(entrance.offset - start, 0), span - 1);
              const along = PAD + EDGE + (within + 0.5) * cell;
              const card = { width: width + 2 * (PAD + EDGE), height: height + 2 * (PAD + EDGE) };
              const cx = horizontal ? along : entrance.side === "LEFT" ? 0 : card.width;
              const cy = horizontal ? (entrance.side === "TOP" ? 0 : card.height) : along;
              // One tag, turned on the sides so its word runs along the edge, tops of the letters
              // facing out.
              const [w, h] = [58, 16];
              const turn = horizontal ? "0deg" : entrance.side === "LEFT" ? "-90deg" : "90deg";
              return (
                <View
                  key={`e${i}`}
                  pointerEvents="none"
                  className="items-center justify-center rounded-full bg-ink"
                  style={{
                    position: "absolute",
                    left: cx - w / 2,
                    top: cy - h / 2,
                    width: w,
                    height: h,
                    transform: [{ rotate: turn }],
                  }}
                >
                  <Text className="text-[9.5px] leading-[12px] font-semibold text-white">
                    {t("components.venueLayout.entrance")}
                  </Text>
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
}
