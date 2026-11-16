import type { components } from "@hagz/api";
import type { EntranceSide, VenueLayout } from "@hagz/contracts";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import type { Ground } from "@/lib/grounds";
import { CELL, clashes, fitsIn, footprintOf, type Rect, type Tile } from "@/lib/layout";
import { AmenityIcon } from "./amenity-icon";
import { IconArrowDown } from "./icons";
import { Text } from "./text";

type Amenity = components["schemas"]["Amenity"];

// The venue layout drawn to scale and moved with the fingers (Figma "Layout", 376:2–378:2): a grid
// that runs past the venue across the whole screen, the venue's outline in ink, its grounds as blue
// pitches with their names, its amenities as grey tiles, and its entrances as black tags on the
// edge. Drag the map to move it, pinch to zoom.
//
// Tap a tile to select it; drag a selected one to move it, a cell at a time; drag a selected
// amenity's corners to size it (1–4 cells each way); drag a selected entrance along the edge. While
// something's moved where it can't go it shows as a dashed outline and says what's in the way
// (onTrouble), and dropped there it goes back. Tap the empty map to let go.
//
// Everything sits in one "world" view, a cell CELL points at zoom 1, which the gestures move and
// scale; nothing inside re-renders while they do. The grid lines are thin plain views rather than
// one big SVG: an SVG's bitmap grows with its size times the zoom, and would run to hundreds of MB.

const ZOOM = { duration: 220 };
const BACK = { duration: 160 };
// How much of the venue must stay on screen while it's dragged about.
const KEEP = 60;
const MAX_AMENITY = 4;

export interface Camera {
  scale: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  // A tile, corner or entrance is under a finger: the map stays put rather than moving with it.
  busy: SharedValue<boolean>;
  min: number;
  max: number;
}

// Where the venue starts: as large as fits in `area` (what the header and tray leave), centred in it.
export const fitCamera = (
  layout: Pick<VenueLayout, "columns" | "rows">,
  screen: { width: number; height: number },
  area: { top: number; bottom: number },
) => {
  const width = layout.columns * CELL;
  const height = layout.rows * CELL;
  const roomWidth = screen.width - 40;
  const roomHeight = screen.height - area.top - area.bottom;
  const scale = Math.min(roomWidth / width, roomHeight / height);
  return {
    scale,
    x: (screen.width - width * scale) / 2,
    y: area.top + (roomHeight - height * scale) / 2,
    min: scale * 0.6,
    max: Math.max(3, scale * 2),
  };
};

export function useCamera(start: ReturnType<typeof fitCamera>): Camera {
  const scale = useSharedValue(start.scale);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const busy = useSharedValue(false);
  return { scale, x, y, busy, min: start.min, max: start.max };
}

// Zooms by `factor` around a point on screen (the middle, for the + and − buttons).
export const zoomAround = (camera: Camera, factor: number, focus: { x: number; y: number }) => {
  const next = Math.min(camera.max, Math.max(camera.min, camera.scale.value * factor));
  const applied = next / camera.scale.value;
  camera.x.value = withTiming(focus.x - (focus.x - camera.x.value) * applied, ZOOM);
  camera.y.value = withTiming(focus.y - (focus.y - camera.y.value) * applied, ZOOM);
  camera.scale.value = withTiming(next, ZOOM);
};

// What's in the way of something being moved: the names of what it lands on, or that it's past the
// edge. Null once it's clear.
export type Trouble = { outside: true } | { outside: false; names: string[] } | null;

export interface Editing {
  tiles: Tile[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  onMove: (key: string, x: number, y: number) => void;
  onResize: (key: string, rect: Rect) => void;
  onMoveEntrance: (index: number, side: EntranceSide, offset: number) => void;
  onTrouble: (trouble: Trouble) => void;
}

export function LayoutCanvas({
  layout,
  grounds,
  amenities,
  camera,
  screen,
  editing,
}: {
  layout: VenueLayout;
  grounds: Map<string, Ground>;
  amenities: Map<string, Amenity>;
  camera: Camera;
  screen: { width: number; height: number };
  editing: Editing;
}) {
  const { t } = useTranslation();
  const width = layout.columns * CELL;
  const height = layout.rows * CELL;

  // Both gestures change the camera by what moved since their last update, so dragging and pinching
  // at once add up instead of fighting over it.
  const panned = useSharedValue({ x: 0, y: 0 });
  const pinched = useSharedValue(1);
  const keepOnScreen = () => {
    "worklet";
    const s = camera.scale.value;
    camera.x.value = Math.min(screen.width - KEEP, Math.max(KEEP - width * s, camera.x.value));
    camera.y.value = Math.min(screen.height - KEEP, Math.max(KEEP - height * s, camera.y.value));
  };
  const pan = Gesture.Pan()
    .maxPointers(2)
    .onStart((event) => {
      panned.value = { x: event.translationX, y: event.translationY };
    })
    .onUpdate((event) => {
      if (!camera.busy.value) {
        camera.x.value += event.translationX - panned.value.x;
        camera.y.value += event.translationY - panned.value.y;
        keepOnScreen();
      }
      panned.value = { x: event.translationX, y: event.translationY };
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinched.value = 1;
    })
    .onUpdate((event) => {
      const factor = event.scale / pinched.value;
      pinched.value = event.scale;
      if (camera.busy.value) return;
      const next = Math.min(camera.max, Math.max(camera.min, camera.scale.value * factor));
      const applied = next / camera.scale.value;
      // The point between the fingers stays where it is.
      camera.x.value = event.focalX - (event.focalX - camera.x.value) * applied;
      camera.y.value = event.focalY - (event.focalY - camera.y.value) * applied;
      camera.scale.value = next;
      keepOnScreen();
    });

  const world = useAnimatedStyle(() => ({
    transform: [
      { translateX: camera.x.value },
      { translateY: camera.y.value },
      { scale: camera.scale.value },
    ],
  }));

  const shared = {
    tiles: editing.tiles,
    columns: layout.columns,
    rows: layout.rows,
    camera,
    onSelect: editing.onSelect,
    onTrouble: editing.onTrouble,
  };

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
      <View className="absolute inset-0 overflow-hidden bg-field">
        {/* Under everything: a tap on the empty map lets go of what's selected. */}
        <Pressable
          accessible={false}
          className="absolute inset-0"
          onPress={() => editing.onSelect(null)}
        />
        <Animated.View
          pointerEvents="box-none"
          style={[
            { position: "absolute", left: 0, top: 0, width, height, transformOrigin: "0 0" },
            world,
          ]}
        >
          <Grid columns={layout.columns} rows={layout.rows} minScale={camera.min} screen={screen} />
          {/* The venue's outline over the grid, as the frames draw it. */}
          <View pointerEvents="none" className="absolute inset-0 rounded-[4px] border border-ink" />
          {layout.grounds.map((placed) => {
            const ground = grounds.get(placed.groundId);
            if (!ground) return null;
            const key = `g:${placed.groundId}`;
            const name = ground.name ?? t("screens.setup.grounds.unnamed");
            return (
              <EditableTile
                key={key}
                tileKey={key}
                name={name}
                rect={{ x: placed.x, y: placed.y, ...footprintOf(ground, placed.orientation) }}
                selected={editing.selected === key}
                onDrop={editing.onMove}
                {...shared}
              >
                {(size) => <GroundArt name={name} width={size.width} height={size.height} />}
              </EditableTile>
            );
          })}
          {layout.amenities.map((placed, index) => {
            const amenity = amenities.get(placed.optionId);
            if (!amenity) return null;
            const key = `a:${String(index)}`;
            return (
              <EditableTile
                key={key}
                tileKey={key}
                name={amenity.name}
                rect={placed}
                selected={editing.selected === key}
                onDrop={editing.onMove}
                onResize={editing.onResize}
                {...shared}
              >
                {() => <AmenityArt amenity={amenity} columns={placed.width} rows={placed.height} />}
              </EditableTile>
            );
          })}
          {layout.entrances.map((entrance, index) => (
            <EntranceTag
              key={`e:${String(index)}`}
              index={index}
              side={entrance.side}
              offset={entrance.offset}
              columns={layout.columns}
              rows={layout.rows}
              others={layout.entrances.filter((_, other) => other !== index)}
              selected={editing.selected === `e:${String(index)}`}
              camera={camera}
              onSelect={editing.onSelect}
              onMove={editing.onMoveEntrance}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// A ground or an amenity on the grid. It's drawn at its rect plus whatever a drag or a corner has
// moved it by (in whole cells, on the UI thread), and checked as it goes: past the edge or on top
// of something, it turns into a dashed outline and says what's in the way. Let go somewhere clear
// and the new spot is handed up; anywhere else and it slides back.
function EditableTile({
  tileKey,
  name,
  rect,
  selected,
  tiles,
  columns,
  rows,
  camera,
  onSelect,
  onTrouble,
  onDrop,
  onResize,
  children,
}: {
  tileKey: string;
  name: string;
  rect: Rect;
  selected: boolean;
  tiles: Tile[];
  columns: number;
  rows: number;
  camera: Camera;
  onSelect: (key: string | null) => void;
  onTrouble: (trouble: Trouble) => void;
  onDrop: (key: string, x: number, y: number) => void;
  onResize?: (key: string, rect: Rect) => void;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  // Where it stands (from above) and how far it's been moved or stretched, in cells. Both live on
  // the UI thread and change together when a drop lands, so it never shows the move twice.
  const base = useSharedValue(rect);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const dw = useSharedValue(0);
  const dh = useSharedValue(0);
  const blocked = useSharedValue(false);
  // What was last said about it, so the HUD only hears about changes.
  const said = useSharedValue("");
  // A corner is being dragged: the tile itself doesn't move.
  const sizing = useSharedValue(false);

  // A new rect from above (the drop landed): the offsets are in it now.
  useEffect(() => {
    base.value = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    dx.value = 0;
    dy.value = 0;
    dw.value = 0;
    dh.value = 0;
    blocked.value = false;
  }, [rect.x, rect.y, rect.width, rect.height, base, dx, dy, dw, dh, blocked]);

  const current = () => {
    "worklet";
    return {
      x: base.value.x + dx.value,
      y: base.value.y + dy.value,
      width: base.value.width + dw.value,
      height: base.value.height + dh.value,
    };
  };
  const check = () => {
    "worklet";
    const at = current();
    const outside = !fitsIn(at, columns, rows);
    const hits = outside ? [] : clashes(at, tiles, tileKey).map((tile) => tile.name);
    blocked.value = outside || hits.length > 0;
    const words = outside ? "outside" : hits.join("|");
    if (words === said.value) return;
    said.value = words;
    runOnJS(onTrouble)(
      outside ? { outside: true } : hits.length ? { outside: false, names: hits } : null,
    );
  };
  const settle = () => {
    "worklet";
    camera.busy.value = false;
    said.value = "";
    if (blocked.value) {
      // Back where it was.
      dx.value = 0;
      dy.value = 0;
      dw.value = 0;
      dh.value = 0;
      blocked.value = false;
      return false;
    }
    return true;
  };

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(tileKey);
  });
  const move = Gesture.Pan()
    .enabled(selected)
    .onBegin(() => {
      camera.busy.value = true;
    })
    .onUpdate((event) => {
      if (sizing.value) return;
      const step = CELL * camera.scale.value;
      const x = Math.round(event.translationX / step);
      const y = Math.round(event.translationY / step);
      if (x === dx.value && y === dy.value) return;
      dx.value = x;
      dy.value = y;
      check();
    })
    .onEnd(() => {
      if (sizing.value) return;
      const moved = dx.value !== 0 || dy.value !== 0;
      if (settle() && moved) {
        const at = current();
        runOnJS(onDrop)(tileKey, at.x, at.y);
      }
    })
    .onFinalize(() => {
      camera.busy.value = false;
    });

  const box = useAnimatedStyle(() => {
    const at = current();
    return {
      left: at.x * CELL,
      top: at.y * CELL,
      width: at.width * CELL,
      height: at.height * CELL,
      zIndex: selected ? 2 : 1,
    };
  });
  const art = useAnimatedStyle(() => ({ opacity: blocked.value ? 0 : 1 }));
  const ghost = useAnimatedStyle(() => ({ opacity: blocked.value ? 1 : 0 }));

  return (
    <GestureDetector gesture={Gesture.Race(move, tap)}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[{ position: "absolute" }, box]}
      >
        <Animated.View style={[{ flex: 1 }, art]}>
          {children({ width: rect.width * CELL, height: rect.height * CELL })}
        </Animated.View>
        {/* Where it can't go: a dashed outline with its name (Figma 378:2). */}
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center rounded-[6px] border border-dashed border-ink bg-white"
          style={ghost}
        >
          <Text className="text-[12px] font-semibold" numberOfLines={1}>
            {name}
          </Text>
        </Animated.View>
        {selected ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 rounded-[6px] border-2 border-primary"
          />
        ) : null}
        {selected && onResize
          ? CORNERS.map((corner) => (
              <Corner
                key={corner.name}
                corner={corner}
                rect={rect}
                camera={camera}
                dx={dx}
                dy={dy}
                dw={dw}
                dh={dh}
                sizing={sizing}
                check={check}
                onEnd={() => {
                  "worklet";
                  const changed = dw.value !== 0 || dh.value !== 0;
                  const at = current();
                  if (settle() && changed) runOnJS(onResize)(tileKey, at);
                }}
              />
            ))
          : null}
      </Animated.View>
    </GestureDetector>
  );
}

// The corners of a selected amenity (Figma 377:2): `x` and `y` say which edges each one moves.
const CORNERS = [
  { name: "top-left", x: -1, y: -1 },
  { name: "top-right", x: 1, y: -1 },
  { name: "bottom-left", x: -1, y: 1 },
  { name: "bottom-right", x: 1, y: 1 },
] as const;
const HANDLE = 10;

function Corner({
  corner,
  rect,
  camera,
  dx,
  dy,
  dw,
  dh,
  sizing,
  check,
  onEnd,
}: {
  corner: (typeof CORNERS)[number];
  rect: Rect;
  camera: Camera;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  dw: SharedValue<number>;
  dh: SharedValue<number>;
  sizing: SharedValue<boolean>;
  check: () => void;
  onEnd: () => void;
}) {
  const stretch = Gesture.Pan()
    // A 10-point dot is hard to hit: it answers a little way around it too.
    .hitSlop(14)
    .onBegin(() => {
      sizing.value = true;
      camera.busy.value = true;
    })
    .onUpdate((event) => {
      const step = CELL * camera.scale.value;
      const along = Math.round(event.translationX / step) * corner.x;
      const down = Math.round(event.translationY / step) * corner.y;
      const width = Math.min(MAX_AMENITY, Math.max(1, rect.width + along));
      const height = Math.min(MAX_AMENITY, Math.max(1, rect.height + down));
      dw.value = width - rect.width;
      dh.value = height - rect.height;
      // A left or top corner moves that edge, so the tile's start moves with it.
      dx.value = corner.x < 0 ? rect.width - width : 0;
      dy.value = corner.y < 0 ? rect.height - height : 0;
      check();
    })
    .onEnd(() => {
      onEnd();
    })
    .onFinalize(() => {
      sizing.value = false;
      camera.busy.value = false;
    });
  return (
    <GestureDetector gesture={stretch}>
      <View
        className="rounded-full border-2 border-primary bg-white"
        style={{
          position: "absolute",
          width: HANDLE,
          height: HANDLE,
          left: corner.x < 0 ? -HANDLE / 2 : undefined,
          right: corner.x > 0 ? -HANDLE / 2 : undefined,
          top: corner.y < 0 ? -HANDLE / 2 : undefined,
          bottom: corner.y > 0 ? -HANDLE / 2 : undefined,
        }}
      />
    </GestureDetector>
  );
}

function GroundArt({ name, width, height }: { name: string; width: number; height: number }) {
  return (
    <View style={{ width, height }}>
      <PitchArt width={width} height={height} />
      <View className="absolute inset-0 items-center justify-center">
        <View className="max-w-full rounded-[8px] bg-white px-[7px] py-[2px]">
          <Text className="text-[12px] font-medium" numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>
    </View>
  );
}

// A grey tile with the amenity's icon, and its name when there's room for it (three cells by two,
// like the frames' café).
function AmenityArt({
  amenity,
  columns,
  rows,
}: {
  amenity: Amenity;
  columns: number;
  rows: number;
}) {
  const named = columns >= 3 && rows >= 2;
  const roomy = columns >= 2 && rows >= 2;
  return (
    <View className="flex-1 items-center justify-center gap-0.5 overflow-hidden rounded-[6px] border border-chip-line bg-chip">
      <AmenityIcon name={amenity.icon} size={roomy ? 24 : 14} color={colors.ink2} />
      {named ? (
        <Text className="text-[11px] font-medium text-ink-2" numberOfLines={1}>
          {amenity.name}
        </Text>
      ) : null}
    </View>
  );
}

// The side an entrance is on, as a number the UI thread can do sums with, and back.
const SIDES: EntranceSide[] = ["TOP", "RIGHT", "BOTTOM", "LEFT"];
// The arrow points out through the side the entrance is on.
const ARROW_TURN = ["180deg", "-90deg", "0deg", "90deg"];

// Where an entrance's tag is centred: the middle of its cell on its side.
const entranceCentre = (side: number, offset: number, columns: number, rows: number) => {
  "worklet";
  const along = (offset + 0.5) * CELL;
  if (side === 0) return { x: along, y: 0 };
  if (side === 1) return { x: columns * CELL, y: along };
  if (side === 2) return { x: along, y: rows * CELL };
  return { x: 0, y: along };
};

// A black tag centred on the venue's edge. Selected, it can be dragged along the edges: it goes to
// whichever side is nearest the finger, at the cell it's beside.
function EntranceTag({
  index,
  side,
  offset,
  columns,
  rows,
  others,
  selected,
  camera,
  onSelect,
  onMove,
}: {
  index: number;
  side: EntranceSide;
  offset: number;
  columns: number;
  rows: number;
  others: { side: EntranceSide; offset: number }[];
  selected: boolean;
  camera: Camera;
  onSelect: (key: string | null) => void;
  onMove: (index: number, side: EntranceSide, offset: number) => void;
}) {
  const { t } = useTranslation();
  const at = useSharedValue({ side: SIDES.indexOf(side), offset });
  useEffect(() => {
    at.value = { side: SIDES.indexOf(side), offset };
  }, [side, offset, at]);
  const taken = others.map(
    (other) => `${String(SIDES.indexOf(other.side))}:${String(other.offset)}`,
  );

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(`e:${String(index)}`);
  });
  const move = Gesture.Pan()
    .enabled(selected)
    .onBegin(() => {
      camera.busy.value = true;
    })
    .onUpdate((event) => {
      const start = entranceCentre(SIDES.indexOf(side), offset, columns, rows);
      const x = start.x + event.translationX / camera.scale.value;
      const y = start.y + event.translationY / camera.scale.value;
      // The nearest side, and the cell along it.
      const width = columns * CELL;
      const height = rows * CELL;
      const distances = [Math.abs(y), Math.abs(x - width), Math.abs(y - height), Math.abs(x)];
      const nearest = distances.indexOf(Math.min(...distances));
      const length = nearest === 0 || nearest === 2 ? columns : rows;
      const along = nearest === 0 || nearest === 2 ? x : y;
      const cell = Math.min(length - 1, Math.max(0, Math.floor(along / CELL)));
      if (taken.includes(`${String(nearest)}:${String(cell)}`)) return;
      if (nearest !== at.value.side || cell !== at.value.offset) {
        at.value = { side: nearest, offset: cell };
      }
    })
    .onEnd(() => {
      const moved = at.value.side !== SIDES.indexOf(side) || at.value.offset !== offset;
      const next = SIDES[at.value.side];
      if (moved && next) runOnJS(onMove)(index, next, at.value.offset);
    })
    .onFinalize(() => {
      camera.busy.value = false;
    });

  const place = useAnimatedStyle(() => {
    const centre = entranceCentre(at.value.side, at.value.offset, columns, rows);
    return { left: centre.x - 60, top: centre.y - 12 };
  });
  const arrow = useAnimatedStyle(() => ({
    transform: [{ rotate: ARROW_TURN[at.value.side] ?? "0deg" }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(move, tap)}>
      <Animated.View
        className="items-center justify-center"
        style={[{ position: "absolute", width: 120, height: 24, zIndex: 3 }, place]}
        pointerEvents="box-none"
      >
        <View
          accessibilityRole="button"
          accessibilityLabel={t("screens.setup.layout.entrance")}
          className={`h-6 flex-row items-center gap-1 rounded-full bg-ink pl-1 pr-2 ${selected ? "border-2 border-primary" : ""}`}
        >
          <Animated.View style={arrow}>
            <IconArrowDown size={14} color={colors.white} strokeWidth={2} />
          </Animated.View>
          <Text className="text-[11px] font-medium text-white">
            {t("screens.setup.layout.entrance")}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// The grid: white over the venue, the field grey around it, lines every cell across both, reaching
// far enough out to fill the screen at the furthest zoom.
function Grid({
  columns,
  rows,
  minScale,
  screen,
}: {
  columns: number;
  rows: number;
  minScale: number;
  screen: { width: number; height: number };
}) {
  const reach = Math.min(120, Math.ceil(Math.max(screen.width, screen.height) / (minScale * CELL)));
  const from = -reach * CELL;
  const across = (columns + reach * 2) * CELL;
  const down = (rows + reach * 2) * CELL;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}>
      <View
        className="bg-white"
        style={{ position: "absolute", width: columns * CELL, height: rows * CELL }}
      />
      {Array.from({ length: columns + reach * 2 + 1 }, (_, i) => (
        <View
          key={`c${String(i)}`}
          style={{
            position: "absolute",
            left: from + i * CELL,
            top: from,
            width: 1,
            height: down,
            backgroundColor: colors.grid,
          }}
        />
      ))}
      {Array.from({ length: rows + reach * 2 + 1 }, (_, i) => (
        <View
          key={`r${String(i)}`}
          style={{
            position: "absolute",
            left: from,
            top: from + i * CELL,
            width: across,
            height: 1,
            backgroundColor: colors.grid,
          }}
        />
      ))}
    </View>
  );
}

// A pitch: pale blue, a white outline inset from its edge and the halfway line across its length.
// The same drawing, smaller, marks a ground in the tray.
export function PitchArt({
  width,
  height,
  inset = 5,
  line = 1.4,
  radius = 6,
}: {
  width: number;
  height: number;
  inset?: number;
  line?: number;
  radius?: number;
}) {
  const across = width >= height;
  return (
    <View className="bg-pitch" style={{ width, height, borderRadius: radius }}>
      <View
        style={{
          position: "absolute",
          left: inset,
          top: inset,
          right: inset,
          bottom: inset,
          borderWidth: line,
          borderColor: colors.white,
          borderRadius: 2,
        }}
      />
      <View
        style={
          across
            ? {
                position: "absolute",
                left: width / 2 - line / 2,
                top: inset,
                bottom: inset,
                width: line,
                backgroundColor: colors.white,
              }
            : {
                position: "absolute",
                top: height / 2 - line / 2,
                left: inset,
                right: inset,
                height: line,
                backgroundColor: colors.white,
              }
        }
      />
    </View>
  );
}
