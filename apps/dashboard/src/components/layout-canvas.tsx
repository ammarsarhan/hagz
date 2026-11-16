import type { components } from "@hagz/api";
import type { EntranceSide, VenueLayout } from "@hagz/contracts";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import type { Ground } from "@/lib/grounds";
import { MAXIMUM_LAYOUT_CELLS } from "@hagz/contracts";
import {
  CELL,
  clashes,
  fitsIn,
  footprintRange,
  oriented,
  type Rect,
  type Tile,
} from "@/lib/layout";
import { AmenityIcon } from "./amenity-icon";
import { IconArrowDown, IconArrowsDiagonal2 } from "./icons";
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
// Something new on the layout fades in rather than popping.
const APPEAR = FadeIn.duration(200);
// Gliding into place on a drop, or back where it came from.
const GLIDE = { duration: 200 };
// Easing between cells while sizing, and an entrance between cells as it's dragged.
const STEP = { duration: 120 };
// How much of the venue must stay on screen while it's dragged about.
const KEEP = 60;
type SizeRange = { width: readonly [number, number]; height: readonly [number, number] };
// An amenity can be any size from a cell; the grid's edges and what's around it stop it growing.
const ANY_SIZE: SizeRange = {
  width: [1, MAXIMUM_LAYOUT_CELLS],
  height: [1, MAXIMUM_LAYOUT_CELLS],
};

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

// Something being dragged out of the tray: where it would land (in cells), whether it's over the
// map at all, and whether it would fit there.
export interface GhostState {
  shown: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  blocked: boolean;
}

export const NO_GHOST: GhostState = {
  shown: false,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  blocked: false,
};

export interface Ghost {
  state: SharedValue<GhostState>;
  // Its top-left corner under the finger, in points on the map: it follows smoothly, while
  // `state` says which cells it would land on.
  gx: SharedValue<number>;
  gy: SharedValue<number>;
  // What it looks like, drawn at its size, and its name for the dashed outline.
  art: ReactNode;
  name: string;
}

// How far each of the venue's edges has been dragged out (in cells; in is negative).
export interface Grow {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
const NO_GROWTH: Grow = { left: 0, top: 0, right: 0, bottom: 0 };

export interface Editing {
  // The preview: nothing can be selected, moved or sized.
  readOnly: boolean;
  tiles: Tile[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  onMove: (key: string, x: number, y: number) => void;
  onResize: (key: string, rect: Rect) => void;
  onMoveEntrance: (index: number, side: EntranceSide, offset: number) => void;
  onTrouble: (trouble: Trouble) => void;
  // The venue's size while an edge is dragged (null once it's let go), and the edges' final move.
  onSizing: (size: { columns: number; rows: number } | null) => void;
  onResizeVenue: (grow: Grow) => void;
}

export function LayoutCanvas({
  layout,
  grounds,
  amenities,
  camera,
  screen,
  editing,
  ghost,
}: {
  layout: VenueLayout;
  grounds: Map<string, Ground>;
  amenities: Map<string, Amenity>;
  camera: Camera;
  screen: { width: number; height: number };
  editing: Editing;
  ghost: Ghost | null;
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

  // The venue's edges as they're dragged; reset once the new size has come back down as props.
  const edges = useSharedValue<Grow>(NO_GROWTH);
  // An edge is being dragged, so the venue eases between sizes. Off when the resize lands: the
  // grid's start may have moved with the map, and easing then would slide it.
  const easing = useSharedValue(false);
  // A resize that moved the left or top edge shifts every cell: the map moves by as much, before
  // the new layout paints, so nothing on screen jumps.
  const shifting = useRef<Grow | null>(null);
  useLayoutEffect(() => {
    const done = shifting.current;
    if (!done) return;
    shifting.current = null;
    const step = CELL * camera.scale.value;
    easing.value = false;
    camera.x.value -= done.left * step;
    camera.y.value -= done.top * step;
    edges.value = NO_GROWTH;
  }, [layout, camera, edges, easing]);
  const resizeVenue = (grow: Grow) => {
    shifting.current = grow;
    editing.onSizing(null);
    editing.onResizeVenue(grow);
  };
  const sheet = useAnimatedStyle(() => {
    const ease = (to: number) => (easing.value ? withTiming(to, STEP) : to);
    return {
      left: ease(-edges.value.left * CELL),
      top: ease(-edges.value.top * CELL),
      width: ease((layout.columns + edges.value.left + edges.value.right) * CELL),
      height: ease((layout.rows + edges.value.top + edges.value.bottom) * CELL),
    };
  });
  // How far each edge can go: out to the API's limit, in until it meets something placed (a tile,
  // or an entrance on the edges it runs along) or leaves a single cell.
  const used = usedArea(layout, editing.tiles);

  const shared = {
    readOnly: editing.readOnly,
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
          {/* The venue: white under the grid's lines, its outline over them. */}
          <Animated.View
            pointerEvents="none"
            className="bg-white"
            style={[{ position: "absolute" }, sheet]}
          />
          <Grid columns={layout.columns} rows={layout.rows} minScale={camera.min} screen={screen} />
          <Animated.View
            pointerEvents="none"
            className="rounded-[4px] border border-ink"
            style={[{ position: "absolute" }, sheet]}
          />
          {!editing.readOnly && editing.selected === null
            ? EDGES.map((side) => (
                <VenueEdge
                  key={side}
                  side={side}
                  columns={layout.columns}
                  rows={layout.rows}
                  used={used}
                  edges={edges}
                  easing={easing}
                  camera={camera}
                  onSizing={editing.onSizing}
                  onEnd={resizeVenue}
                />
              ))
            : null}
          {/* What's there when the screen opens just appears; anything added after fades in. */}
          <LayoutAnimationConfig skipEntering>
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
                  rect={{ x: placed.x, y: placed.y, ...oriented(placed, placed.orientation) }}
                  selected={editing.selected === key}
                  onDrop={editing.onMove}
                  onResize={editing.onResize}
                  range={footprintRange(ground, placed.orientation)}
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
                  range={ANY_SIZE}
                  {...shared}
                >
                  {() => (
                    <AmenityArt amenity={amenity} columns={placed.width} rows={placed.height} />
                  )}
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
                readOnly={editing.readOnly}
                camera={camera}
                onSelect={editing.onSelect}
                onMove={editing.onMoveEntrance}
              />
            ))}
            {ghost ? <TrayGhost {...ghost} /> : null}
          </LayoutAnimationConfig>
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
  readOnly,
  tiles,
  columns,
  rows,
  camera,
  onSelect,
  onTrouble,
  onDrop,
  onResize,
  range,
  children,
}: {
  tileKey: string;
  name: string;
  rect: Rect;
  selected: boolean;
  readOnly: boolean;
  tiles: Tile[];
  columns: number;
  rows: number;
  camera: Camera;
  onSelect: (key: string | null) => void;
  onTrouble: (trouble: Trouble) => void;
  onDrop: (key: string, x: number, y: number) => void;
  onResize?: (key: string, rect: Rect) => void;
  // How far its grip can size it, as it lies.
  range?: SizeRange;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  // The size it's at while its grip is dragged ("5 × 3").
  const [liveSize, setLiveSize] = useState<string | null>(null);
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
  // Being dragged: it follows the finger (fx, fy, in points) while dx and dy say the cells it
  // would land on, shaded grey under it.
  const moving = useSharedValue(false);
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);

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

  const tap = Gesture.Tap()
    .enabled(!readOnly)
    .onEnd(() => {
      runOnJS(onSelect)(tileKey);
    });
  const move = Gesture.Pan()
    .enabled(selected && !readOnly)
    .onBegin(() => {
      camera.busy.value = true;
    })
    .onStart(() => {
      if (sizing.value) return;
      fx.value = 0;
      fy.value = 0;
      moving.value = true;
    })
    .onUpdate((event) => {
      if (sizing.value) return;
      fx.value = event.translationX / camera.scale.value;
      fy.value = event.translationY / camera.scale.value;
      const x = Math.round(fx.value / CELL);
      const y = Math.round(fy.value / CELL);
      if (x === dx.value && y === dy.value) return;
      dx.value = x;
      dy.value = y;
      check();
    })
    .onEnd(() => {
      if (sizing.value) return;
      // From here it glides from the finger to where it lands (or back).
      moving.value = false;
      const moved = dx.value !== 0 || dy.value !== 0;
      if (settle() && moved) {
        const at = current();
        runOnJS(onDrop)(tileKey, at.x, at.y);
      }
    })
    .onFinalize(() => {
      camera.busy.value = false;
    });

  // Dragged, it's under the finger; otherwise it eases to its cells. A drop moves the cells from
  // the offset into the rect without changing where they are, so the glide just carries on.
  const box = useAnimatedStyle(() => {
    const at = current();
    const width = withTiming(at.width * CELL, STEP);
    const height = withTiming(at.height * CELL, STEP);
    const zIndex = selected ? 2 : 1;
    if (moving.value) {
      return {
        left: base.value.x * CELL + fx.value,
        top: base.value.y * CELL + fy.value,
        width,
        height,
        zIndex,
      };
    }
    return {
      left: withTiming(at.x * CELL, GLIDE),
      top: withTiming(at.y * CELL, GLIDE),
      width,
      height,
      zIndex,
    };
  });
  // The cells it would land on, grey under it while it's dragged somewhere it fits.
  const landing = useAnimatedStyle(() => {
    const at = current();
    return {
      opacity: moving.value && !blocked.value ? 1 : 0,
      left: at.x * CELL - (base.value.x * CELL + fx.value),
      top: at.y * CELL - (base.value.y * CELL + fy.value),
      width: at.width * CELL,
      height: at.height * CELL,
    };
  });
  const art = useAnimatedStyle(() => ({ opacity: blocked.value ? 0 : 1 }));
  const ghost = useAnimatedStyle(() => ({ opacity: blocked.value ? 1 : 0 }));

  return (
    <GestureDetector gesture={Gesture.Race(move, tap)}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={name}
        entering={APPEAR}
        style={[{ position: "absolute" }, box]}
      >
        <Animated.View
          pointerEvents="none"
          className="rounded-[6px] bg-ink/10"
          style={[{ position: "absolute" }, landing]}
        />
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
        {selected && onResize && range ? (
          <Grip
            rect={rect}
            range={range}
            camera={camera}
            dw={dw}
            dh={dh}
            sizing={sizing}
            check={check}
            onSize={setLiveSize}
            onEnd={() => {
              "worklet";
              const changed = dw.value !== 0 || dh.value !== 0;
              const at = current();
              if (settle() && changed) runOnJS(onResize)(tileKey, at);
            }}
          />
        ) : null}
        {/* The size it's at while the grip is dragged, just past the grip. */}
        {liveSize ? (
          <View
            pointerEvents="none"
            className="rounded-full bg-ink px-2 py-0.5"
            style={{ position: "absolute", right: -GRIP / 2, top: "100%", marginTop: GRIP / 2 + 6 }}
          >
            <Text className="text-[11px] font-medium text-white">{liveSize}</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

// What's being dragged out of the tray, where it would land: drawn as itself where it fits, as a
// dashed outline with its name where it doesn't (Figma 378:2), and not at all over the tray.
function TrayGhost({ state, gx, gy, art, name }: Ghost) {
  const box = useAnimatedStyle(() => ({
    opacity: state.value.shown ? 1 : 0,
    left: gx.value,
    top: gy.value,
    width: state.value.width * CELL,
    height: state.value.height * CELL,
  }));
  const landing = useAnimatedStyle(() => ({
    opacity: state.value.shown && !state.value.blocked ? 1 : 0,
    left: state.value.x * CELL - gx.value,
    top: state.value.y * CELL - gy.value,
    width: state.value.width * CELL,
    height: state.value.height * CELL,
  }));
  const drawn = useAnimatedStyle(() => ({ opacity: state.value.blocked ? 0 : 0.85 }));
  const dashed = useAnimatedStyle(() => ({ opacity: state.value.blocked ? 1 : 0 }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", zIndex: 4 }, box]}>
      <Animated.View
        className="rounded-[6px] bg-ink/10"
        style={[{ position: "absolute" }, landing]}
      />
      <Animated.View style={[{ flex: 1 }, drawn]}>{art}</Animated.View>
      <Animated.View
        className="absolute inset-0 items-center justify-center rounded-[6px] border border-dashed border-ink bg-white"
        style={dashed}
      >
        <Text className="text-[12px] font-semibold" numberOfLines={1}>
          {name}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// The grip on a selected tile's bottom-right corner (⇲): drag it to size the tile a cell at a time,
// within `range` (a ground's sport's sizes as it lies; an amenity anything from one cell). It's
// bigger than a corner dot, so it's easy to take hold of, and shows the size it's at while it moves.
const GRIP = 22;

function Grip({
  rect,
  range,
  camera,
  dw,
  dh,
  sizing,
  check,
  onSize,
  onEnd,
}: {
  rect: Rect;
  range: SizeRange;
  camera: Camera;
  dw: SharedValue<number>;
  dh: SharedValue<number>;
  sizing: SharedValue<boolean>;
  check: () => void;
  onSize: (size: string | null) => void;
  onEnd: () => void;
}) {
  const stretch = Gesture.Pan()
    .hitSlop(12)
    .onBegin(() => {
      sizing.value = true;
      camera.busy.value = true;
    })
    .onUpdate((event) => {
      const step = CELL * camera.scale.value;
      const width = Math.min(
        range.width[1],
        Math.max(range.width[0], rect.width + Math.round(event.translationX / step)),
      );
      const height = Math.min(
        range.height[1],
        Math.max(range.height[0], rect.height + Math.round(event.translationY / step)),
      );
      if (width - rect.width === dw.value && height - rect.height === dh.value) return;
      dw.value = width - rect.width;
      dh.value = height - rect.height;
      check();
      runOnJS(onSize)(`${String(width)} × ${String(height)}`);
    })
    .onEnd(() => {
      onEnd();
    })
    .onFinalize(() => {
      sizing.value = false;
      camera.busy.value = false;
      runOnJS(onSize)(null);
    });
  return (
    <GestureDetector gesture={stretch}>
      <View
        className="items-center justify-center rounded-[7px] border-2 border-primary bg-white"
        style={{
          position: "absolute",
          width: GRIP,
          height: GRIP,
          right: -GRIP / 2,
          bottom: -GRIP / 2,
        }}
      >
        <IconArrowsDiagonal2 size={12} color={colors.primary} strokeWidth={2.25} />
      </View>
    </GestureDetector>
  );
}

export function GroundArt({
  name,
  width,
  height,
}: {
  name: string;
  width: number;
  height: number;
}) {
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
export function AmenityArt({
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
  readOnly,
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
  readOnly: boolean;
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

  const tap = Gesture.Tap()
    .enabled(!readOnly)
    .onEnd(() => {
      runOnJS(onSelect)(`e:${String(index)}`);
    });
  const move = Gesture.Pan()
    .enabled(selected && !readOnly)
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
    return { left: withTiming(centre.x - 60, STEP), top: withTiming(centre.y - 12, STEP) };
  });
  const arrow = useAnimatedStyle(() => ({
    transform: [{ rotate: ARROW_TURN[at.value.side] ?? "0deg" }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(move, tap)}>
      <Animated.View
        entering={APPEAR}
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

// The grid's lines, every cell, over the venue and the field grey around it, reaching far enough out
// to fill the screen at the furthest zoom.
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

// --- The venue's edges ---

const EDGES = ["left", "top", "right", "bottom"] as const;
type Edge = (typeof EDGES)[number];

// The cells something placed reaches to, which an edge can't be dragged in past: tiles, and
// entrances along the edges that run that way (one on the top edge holds the left and right edges).
interface Used {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const usedArea = (layout: VenueLayout, tiles: Tile[]): Used => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const tile of tiles) {
    left = Math.min(left, tile.rect.x);
    top = Math.min(top, tile.rect.y);
    right = Math.max(right, tile.rect.x + tile.rect.width);
    bottom = Math.max(bottom, tile.rect.y + tile.rect.height);
  }
  for (const entrance of layout.entrances) {
    if (entrance.side === "TOP" || entrance.side === "BOTTOM") {
      left = Math.min(left, entrance.offset);
      right = Math.max(right, entrance.offset + 1);
    } else {
      top = Math.min(top, entrance.offset);
      bottom = Math.max(bottom, entrance.offset + 1);
    }
  }
  // Nothing placed: an edge can come in until one cell is left.
  return {
    left: Number.isFinite(left) ? left : layout.columns - 1,
    top: Number.isFinite(top) ? top : layout.rows - 1,
    right: Number.isFinite(right) ? right : 1,
    bottom: Number.isFinite(bottom) ? bottom : 1,
  };
};

const EDGE_LONG = 28;
const EDGE_SHORT = 8;

// A pill on the middle of one of the venue's edges: drag it out to make the venue bigger, in to
// make it smaller, a cell at a time.
function VenueEdge({
  side,
  columns,
  rows,
  used,
  edges,
  easing,
  camera,
  onSizing,
  onEnd,
}: {
  side: Edge;
  columns: number;
  rows: number;
  used: Used;
  edges: SharedValue<Grow>;
  easing: SharedValue<boolean>;
  camera: Camera;
  onSizing: (size: { columns: number; rows: number } | null) => void;
  onEnd: (grow: Grow) => void;
}) {
  const across = side === "left" || side === "right";
  // How far this edge may move: out to the limit, in to what's placed.
  const most = across ? MAXIMUM_LAYOUT_CELLS - columns : MAXIMUM_LAYOUT_CELLS - rows;
  const least =
    side === "left"
      ? -used.left
      : side === "right"
        ? used.right - columns
        : side === "top"
          ? -used.top
          : used.bottom - rows;

  const drag = Gesture.Pan()
    .hitSlop(16)
    .onBegin(() => {
      camera.busy.value = true;
      easing.value = true;
    })
    .onUpdate((event) => {
      const step = CELL * camera.scale.value;
      const moved = across ? event.translationX : event.translationY;
      const outwards = side === "left" || side === "top" ? -moved : moved;
      const cells = Math.min(most, Math.max(least, Math.round(outwards / step)));
      if (cells === edges.value[side]) return;
      edges.value = { ...NO_GROWTH, [side]: cells };
      runOnJS(onSizing)({
        columns: columns + (across ? cells : 0),
        rows: rows + (across ? 0 : cells),
      });
    })
    .onEnd(() => {
      const grow = edges.value;
      if (grow[side] !== 0) runOnJS(onEnd)(grow);
      else {
        easing.value = false;
        runOnJS(onSizing)(null);
      }
    })
    .onFinalize(() => {
      camera.busy.value = false;
    });

  const place = useAnimatedStyle(() => {
    const left = -edges.value.left * CELL;
    const top = -edges.value.top * CELL;
    const width = (columns + edges.value.left + edges.value.right) * CELL;
    const height = (rows + edges.value.top + edges.value.bottom) * CELL;
    const x = side === "left" ? left : side === "right" ? left + width : left + width / 2;
    const y = side === "top" ? top : side === "bottom" ? top + height : top + height / 2;
    const w = across ? EDGE_SHORT : EDGE_LONG;
    const h = across ? EDGE_LONG : EDGE_SHORT;
    const ease = (to: number) => (easing.value ? withTiming(to, STEP) : to);
    return { left: ease(x - w / 2), top: ease(y - h / 2), width: w, height: h };
  });

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        accessibilityRole="adjustable"
        className="rounded-full border-2 border-ink-3 bg-white"
        style={[{ position: "absolute", zIndex: 3 }, place]}
      />
    </GestureDetector>
  );
}
