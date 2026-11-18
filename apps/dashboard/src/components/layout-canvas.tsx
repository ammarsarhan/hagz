import type { components } from "@hagz/api";
import type { EntranceSide, VenueLayout } from "@hagz/contracts";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
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
import { IconArrowDown } from "./icons";
import { Text } from "./text";

type Amenity = components["schemas"]["Amenity"];

// The venue layout drawn to scale and moved with the fingers (Figma "Layout", 376:2–378:2): a grid
// that runs past the venue across the whole screen, the venue's outline in ink, its grounds as blue
// pitches with their names, its amenities as grey tiles, and its entrances as black tags on the
// edge. Drag the map to move it, pinch to zoom.
//
// Tap a tile to select it (or another, to switch); drag a selected one to move it, or its corner
// chevron to size it; drag a selected entrance along the edge. A tile being moved or sized stops at
// the grid's edge and against anything else, sliding along it where it can, so it's never anywhere
// it can't go. Something dragged in from the tray can be, though: it shows as a dashed outline and
// says what's in the way. Tap the empty map to let go.
//
// Everything sits in one "world" view, a cell CELL points at zoom 1, which the gestures move and
// scale; nothing inside re-renders while they do. The grid lines are thin plain views rather than
// one big SVG: an SVG's bitmap grows with its size times the zoom, and would run to hundreds of MB.

const ZOOM = { duration: 220 };
// What's drawn over what: tiles (the selected one over the rest), the venue's outline over all of
// them, the entrances and edge handles on the outline, and anything being brought in from the tray
// over everything.
const Z = { tile: 1, selected: 2, outline: 3, edge: 4, ghost: 5 } as const;

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
  entranceGhost,
}: {
  layout: VenueLayout;
  grounds: Map<string, Ground>;
  amenities: Map<string, Amenity>;
  camera: Camera;
  screen: { width: number; height: number };
  editing: Editing;
  ghost: Ghost | null;
  // An entrance being dragged out of the tray: the edge cell it would go on.
  entranceGhost: SharedValue<EntranceSpot> | null;
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
          {/* The venue: white under the grid's lines; its outline is over the tiles (below). */}
          <Animated.View
            pointerEvents="none"
            className="bg-white"
            style={[{ position: "absolute" }, sheet]}
          />
          <Grid columns={layout.columns} rows={layout.rows} minScale={camera.min} screen={screen} />
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
                  {(size, live) => (
                    <GroundArt name={name} width={size.width} height={size.height} live={live} />
                  )}
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
                  {(size, live) => (
                    <AmenityArt
                      amenity={amenity}
                      width={size.width}
                      height={size.height}
                      live={live}
                    />
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
                edges={edges}
                easing={easing}
                onSelect={editing.onSelect}
                onMove={editing.onMoveEntrance}
              />
            ))}
            {ghost ? <TrayGhost {...ghost} /> : null}
            {entranceGhost ? (
              <EntranceGhost state={entranceGhost} columns={layout.columns} rows={layout.rows} />
            ) : null}
          </LayoutAnimationConfig>
          {/* The venue's outline over every tile, so one against the edge never hides it; the
              entrances and the edge handles sit on top of it. */}
          <Animated.View
            pointerEvents="none"
            className="rounded-[4px] border border-ink"
            style={[{ position: "absolute", zIndex: Z.outline }, sheet]}
          />
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
  onDrop: (key: string, x: number, y: number) => void;
  onResize?: (key: string, rect: Rect) => void;
  // How far its grip can size it, as it lies.
  range?: SizeRange;
  // What it looks like: given its size at rest and, live, as it's being sized.
  children: (size: Size, live: SharedValue<Size>) => ReactNode;
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
  // Its size in points right now, sizing included, for what's drawn inside it.
  const live = useDerivedValue(() => {
    const at = current();
    return { width: at.width * CELL, height: at.height * CELL };
  });
  const settle = () => {
    "worklet";
    camera.busy.value = false;
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
      const at = base.value;
      // Never past the grid's edge.
      let x = Math.min(
        (columns - at.x - at.width) * CELL,
        Math.max(-at.x * CELL, event.translationX / camera.scale.value),
      );
      let y = Math.min(
        (rows - at.y - at.height) * CELL,
        Math.max(-at.y * CELL, event.translationY / camera.scale.value),
      );
      // Never onto something else: it stops against it, and slides along it if it can.
      const hits = (ox: number, oy: number) =>
        clashes(
          { x: at.x + ox / CELL, y: at.y + oy / CELL, width: at.width, height: at.height },
          tiles,
          tileKey,
        ).length > 0;
      if (hits(x, y)) {
        if (!hits(x, fy.value)) y = fy.value;
        else if (!hits(fx.value, y)) x = fx.value;
        else {
          x = fx.value;
          y = fy.value;
        }
      }
      fx.value = x;
      fy.value = y;
      // The cells it would land on: the nearest, or the last it could if those are taken.
      const cellX = Math.round(x / CELL);
      const cellY = Math.round(y / CELL);
      const landing = {
        x: at.x + cellX,
        y: at.y + cellY,
        width: at.width,
        height: at.height,
      };
      if (clashes(landing, tiles, tileKey).length > 0) return;
      dx.value = cellX;
      dy.value = cellY;
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
    const zIndex = selected ? Z.selected : Z.tile;
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
          {children({ width: rect.width * CELL, height: rect.height * CELL }, live)}
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
            fits={(width, height) => {
              "worklet";
              const at = { x: rect.x, y: rect.y, width, height };
              return fitsIn(at, columns, rows) && clashes(at, tiles, tileKey).length === 0;
            }}
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
            style={{
              position: "absolute",
              right: -CHEVRON_OUT,
              top: "100%",
              marginTop: CHEVRON_OUT + 8,
            }}
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
    <Animated.View pointerEvents="none" style={[{ position: "absolute", zIndex: Z.ghost }, box]}>
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
const GRIP = 14;
const CHEVRON_STROKE = 3;
// How far the chevron sits outside the corner, clear of the selection outline.
const CHEVRON_OUT = 5;

function Grip({
  rect,
  range,
  camera,
  dw,
  dh,
  sizing,
  fits,
  onSize,
  onEnd,
}: {
  rect: Rect;
  range: SizeRange;
  camera: Camera;
  dw: SharedValue<number>;
  dh: SharedValue<number>;
  sizing: SharedValue<boolean>;
  // Whether it can be this size where it stands: inside the grid, on nothing else.
  fits: (width: number, height: number) => boolean;
  onSize: (size: string | null) => void;
  onEnd: () => void;
}) {
  const stretch = Gesture.Pan()
    // Easy to take hold of from inside the tile; only a little way out, so a tap on the tile next
    // door still reaches it.
    .hitSlop({ left: 18, top: 18, right: 6, bottom: 6 })
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
      // It stops growing at the grid's edge or against something else, either way on its own.
      let w = width;
      let h = height;
      if (!fits(w, h)) {
        if (fits(w, rect.height + dh.value)) h = rect.height + dh.value;
        else if (fits(rect.width + dw.value, h)) w = rect.width + dw.value;
        else return;
      }
      if (w - rect.width === dw.value && h - rect.height === dh.value) return;
      dw.value = w - rect.width;
      dh.value = h - rect.height;
      runOnJS(onSize)(`${String(w)} × ${String(h)}`);
    })
    .onEnd(() => {
      onEnd();
    })
    .onFinalize(() => {
      sizing.value = false;
      camera.busy.value = false;
      runOnJS(onSize)(null);
    });
  // A chevron at 45°, its point on the tile's corner and pointing out of it (⌟): two strokes along
  // the bottom and right edges, the way a window's size grip reads.
  return (
    <GestureDetector gesture={stretch}>
      <View
        style={{
          position: "absolute",
          width: GRIP,
          height: GRIP,
          right: -CHEVRON_OUT,
          bottom: -CHEVRON_OUT,
          borderRightWidth: CHEVRON_STROKE,
          borderBottomWidth: CHEVRON_STROKE,
          borderColor: colors.primary,
          borderBottomRightRadius: 3,
        }}
      />
    </GestureDetector>
  );
}

// A pitch with its name, always. Across the pitch when it fits there; turned to read down the
// pitch (top to bottom) when it only fits that way; across and cut short with "…" when it fits
// neither. Worked out on the UI thread from the pitch's live size, so it turns and fits as the
// pitch is sized; the name's own width is measured once, off screen.
export function GroundArt({
  name,
  width,
  height,
  live,
}: {
  name: string;
  // Its size at rest, and as it's being sized (on the UI thread) when it is.
  width: number;
  height: number;
  live?: SharedValue<Size>;
}) {
  const still = { width, height };
  const label = useSharedValue(0);
  const turned = () => {
    "worklet";
    const size = live ? live.value : still;
    const across = label.value + 2 * GROUND_PAD <= size.width;
    const down = label.value + 2 * GROUND_PAD <= size.height && GROUND_CHIP <= size.width;
    return label.value > 0 && !across && down;
  };
  // A box the name sits in, centred on the pitch: the pitch itself, or turned a quarter with it.
  const box = useAnimatedStyle(() => {
    const size = live ? live.value : still;
    if (!turned()) {
      return {
        width: size.width,
        height: size.height,
        left: 0,
        top: 0,
        transform: [{ rotate: "0deg" }],
      };
    }
    return {
      width: size.height,
      height: size.width,
      left: (size.width - size.height) / 2,
      top: (size.height - size.width) / 2,
      transform: [{ rotate: "90deg" }],
    };
  });
  const room = useAnimatedStyle(() => {
    const size = live ? live.value : still;
    const length = turned() ? size.height : size.width;
    return { maxWidth: Math.max(0, length - 2 * GROUND_PAD) };
  });
  return (
    <View style={{ flex: 1 }}>
      <PitchArt width={width} height={height} fill />
      <Animated.View
        pointerEvents="none"
        className="items-center justify-center"
        style={[{ position: "absolute" }, box]}
      >
        <Animated.View className="rounded-[8px] bg-white px-[7px] py-[2px]" style={room}>
          <Text className="text-[12px] font-medium" numberOfLines={1}>
            {name}
          </Text>
        </Animated.View>
      </Animated.View>
      <Measure
        onLayout={(event) => {
          label.value = event.nativeEvent.layout.width;
        }}
      >
        <View className="px-[7px] py-[2px]">
          <Text className="text-[12px] font-medium">{name}</Text>
        </View>
      </Measure>
    </View>
  );
}

// A grey tile with the amenity's icon and its name, or just the icon when the name wouldn't fit
// with room around it.
export function AmenityArt({
  amenity,
  width,
  height,
  live,
}: {
  amenity: Amenity;
  width: number;
  height: number;
  live?: SharedValue<Size>;
}) {
  const fit = useLabelFit(live, { width, height }, (w, h, label) => {
    "worklet";
    return (
      Math.max(label, AMENITY_ICON) + 2 * AMENITY_PAD_X <= w &&
      AMENITY_STACK + 2 * AMENITY_PAD_Y <= h
    );
  });
  const icon = useIconScale(live, { width, height }, AMENITY_ICON, 4);
  return (
    <View className="flex-1 overflow-hidden rounded-[6px] border border-chip-line bg-chip">
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center gap-0.5"
        style={fit.shown}
      >
        <AmenityIcon name={amenity.icon} size={AMENITY_ICON} color={colors.ink2} />
        <Text className="text-[11px] font-medium text-ink-2" numberOfLines={1}>
          {amenity.name}
        </Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
        style={fit.hidden}
      >
        <Animated.View style={icon}>
          <AmenityIcon name={amenity.icon} size={AMENITY_ICON} color={colors.ink2} />
        </Animated.View>
      </Animated.View>
      <Measure onLayout={fit.measure}>
        <Text className="text-[11px] font-medium">{amenity.name}</Text>
      </Measure>
    </View>
  );
}

// --- Labels that fit ---

type Size = { width: number; height: number };

// A ground's name stays inside the pitch's white outline (5 in) with 4 to spare at its ends, and
// is only turned if the pitch is wide enough for its chip (a 12-point line, 2 above and below).
const GROUND_PAD = 9;
const GROUND_CHIP = 19;
// An amenity's name shows only with room around it, 8 either side and a little above and below
// its icon and name (the frames' 3 × 2 café just has it); otherwise it fades out for the icon.
const AMENITY_ICON = 24;
const AMENITY_PAD_X = 8;
const AMENITY_PAD_Y = 2;
// The icon, a 2-point gap and an 11-point line.
const AMENITY_STACK = 40;
const FADE = { duration: 150 };

// Whether a name fits, worked out on the UI thread from the tile's live size as it's sized, so the
// name and the icon cross-fade as it goes rather than the name wrapping or being squeezed. The
// name's own width is measured once, off screen (Measure).
function useLabelFit(
  live: SharedValue<Size> | undefined,
  still: Size,
  fits: (width: number, height: number, label: number) => boolean,
) {
  const label = useSharedValue(0);
  const room = () => {
    "worklet";
    const size = live ? live.value : still;
    return label.value > 0 && fits(size.width, size.height, label.value);
  };
  const shown = useAnimatedStyle(() => ({ opacity: withTiming(room() ? 1 : 0, FADE) }));
  const hidden = useAnimatedStyle(() => ({ opacity: withTiming(room() ? 0 : 1, FADE) }));
  const measure = (event: LayoutChangeEvent) => {
    label.value = event.nativeEvent.layout.width;
  };
  return { shown, hidden, measure };
}

// An icon shown on its own shrinks with the tile, keeping `pad` clear around it.
function useIconScale(live: SharedValue<Size> | undefined, still: Size, size: number, pad: number) {
  return useAnimatedStyle(() => {
    const now = live ? live.value : still;
    const room = Math.min(now.width, now.height) - 2 * pad;
    return { transform: [{ scale: Math.max(0.4, Math.min(1, room / size)) }] };
  });
}

// Lays its child out at its natural width, unseen, to measure it: wide enough never to wrap.
function Measure({
  onLayout,
  children,
}: {
  onLayout: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, width: 1000, opacity: 0 }}
    >
      <View style={{ alignSelf: "flex-start" }} onLayout={onLayout}>
        {children}
      </View>
    </View>
  );
}

// The side an entrance is on, as a number the UI thread can do sums with, and back.
export const SIDES: EntranceSide[] = ["TOP", "RIGHT", "BOTTOM", "LEFT"];

// An entrance's place as the UI thread works it out: a side (an index into SIDES) and a cell.
export interface EntranceSpot {
  shown: boolean;
  side: number;
  offset: number;
}
export const NO_ENTRANCE: EntranceSpot = { shown: false, side: 2, offset: 0 };

// The free edge cell nearest a point on the map (in points), or null when the nearest side's cell
// is taken: the side whose line is closest, and the cell beside the point along it.
export const nearestEdge = (
  x: number,
  y: number,
  columns: number,
  rows: number,
  taken: string[],
) => {
  "worklet";
  const width = columns * CELL;
  const height = rows * CELL;
  const distances = [Math.abs(y), Math.abs(x - width), Math.abs(y - height), Math.abs(x)];
  const side = distances.indexOf(Math.min(...distances));
  const length = side === 0 || side === 2 ? columns : rows;
  const along = side === 0 || side === 2 ? x : y;
  const offset = Math.min(length - 1, Math.max(0, Math.floor(along / CELL)));
  return taken.includes(`${String(side)}:${String(offset)}`) ? null : { side, offset };
};
// The arrow points out through the side the entrance is on.
const ARROW_TURN = ["180deg", "-90deg", "0deg", "90deg"];

// Where an entrance's tag is centred: the middle of its cell on its side.
// While an edge is dragged (`grow`), an entrance on it rides along with it, and one on an edge it
// cuts into is pushed along to stay on the venue.
const entranceCentre = (
  side: number,
  offset: number,
  columns: number,
  rows: number,
  edge?: Grow,
) => {
  "worklet";
  // The fallback lives in the body, not as a default parameter: Reanimated's plugin only captures
  // what a worklet's body uses, so a default of NO_GROWTH is undefined on the UI thread.
  const grow = edge ?? NO_GROWTH;
  // Kept on the venue as it is now: an edge coming in pushes it along.
  const along = (offset + 0.5) * CELL;
  const across = Math.min(
    (columns + grow.right) * CELL - CELL / 2,
    Math.max(-grow.left * CELL + CELL / 2, along),
  );
  const down = Math.min(
    (rows + grow.bottom) * CELL - CELL / 2,
    Math.max(-grow.top * CELL + CELL / 2, along),
  );
  if (side === 0) return { x: across, y: -grow.top * CELL };
  if (side === 1) return { x: (columns + grow.right) * CELL, y: down };
  if (side === 2) return { x: across, y: (rows + grow.bottom) * CELL };
  return { x: -grow.left * CELL, y: down };
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
  edges,
  easing,
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
  // The venue's edges as they're dragged, and whether they're easing (see LayoutCanvas).
  edges: SharedValue<Grow>;
  easing: SharedValue<boolean>;
  onSelect: (key: string | null) => void;
  onMove: (index: number, side: EntranceSide, offset: number) => void;
}) {
  const { t } = useTranslation();
  const at = useSharedValue({ side: SIDES.indexOf(side), offset });
  // Being dragged along the edge: it eases from cell to cell.
  const dragging = useSharedValue(false);
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
      dragging.value = true;
    })
    .onUpdate((event) => {
      const start = entranceCentre(SIDES.indexOf(side), offset, columns, rows);
      const x = start.x + event.translationX / camera.scale.value;
      const y = start.y + event.translationY / camera.scale.value;
      const spot = nearestEdge(x, y, columns, rows, taken);
      if (!spot) return;
      if (spot.side !== at.value.side || spot.offset !== at.value.offset) at.value = spot;
    })
    .onEnd(() => {
      const moved = at.value.side !== SIDES.indexOf(side) || at.value.offset !== offset;
      const next = SIDES[at.value.side];
      if (moved && next) runOnJS(onMove)(index, next, at.value.offset);
    })
    .onFinalize(() => {
      camera.busy.value = false;
      dragging.value = false;
    });

  // It eases while it's dragged or its edge is; otherwise it's simply where it is, so the moment a
  // resize lands (the grid's start moving with the map) it doesn't slide.
  const place = useAnimatedStyle(() => {
    const centre = entranceCentre(at.value.side, at.value.offset, columns, rows, edges.value);
    const ease = (to: number) => (dragging.value || easing.value ? withTiming(to, STEP) : to);
    return { left: ease(centre.x - 60), top: ease(centre.y - 12) };
  });
  const arrow = useAnimatedStyle(() => ({
    transform: [{ rotate: ARROW_TURN[at.value.side] ?? "0deg" }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(move, tap)}>
      <Animated.View
        entering={APPEAR}
        className="items-center justify-center"
        style={[{ position: "absolute", width: 120, height: 24, zIndex: Z.edge }, place]}
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
  fill = false,
}: {
  // Its shape: which way the halfway line runs, and its size unless it fills its parent.
  width: number;
  height: number;
  inset?: number;
  line?: number;
  radius?: number;
  // Fills whatever it's in, so it follows a tile being sized.
  fill?: boolean;
}) {
  const across = width >= height;
  return (
    <View
      className="bg-pitch"
      style={[{ borderRadius: radius }, fill ? { flex: 1 } : { width, height }]}
    >
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
                left: "50%",
                marginLeft: -line / 2,
                top: inset,
                bottom: inset,
                width: line,
                backgroundColor: colors.white,
              }
            : {
                position: "absolute",
                top: "50%",
                marginTop: -line / 2,
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

// An entrance being dragged out of the tray, on the edge cell it would go on, faded a little.
function EntranceGhost({
  state,
  columns,
  rows,
}: {
  state: SharedValue<EntranceSpot>;
  columns: number;
  rows: number;
}) {
  const { t } = useTranslation();
  const place = useAnimatedStyle(() => {
    const centre = entranceCentre(state.value.side, state.value.offset, columns, rows);
    return {
      opacity: state.value.shown ? 0.85 : 0,
      left: withTiming(centre.x - 60, STEP),
      top: withTiming(centre.y - 12, STEP),
    };
  });
  const arrow = useAnimatedStyle(() => ({
    transform: [{ rotate: ARROW_TURN[state.value.side] ?? "0deg" }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      className="items-center justify-center"
      style={[{ position: "absolute", width: 120, height: 24, zIndex: Z.ghost }, place]}
    >
      <View className="h-6 flex-row items-center gap-1 rounded-full bg-ink pl-1 pr-2">
        <Animated.View style={arrow}>
          <IconArrowDown size={14} color={colors.white} strokeWidth={2} />
        </Animated.View>
        <Text className="text-[11px] font-medium text-white">
          {t("screens.setup.layout.entrance")}
        </Text>
      </View>
    </Animated.View>
  );
}

// --- The venue's edges ---

const EDGES = ["left", "top", "right", "bottom"] as const;
type Edge = (typeof EDGES)[number];

// The cells the tiles reach to, which an edge can't be dragged in past. Entrances don't hold an
// edge: they're markers on the venue's edge, and an edge coming in pushes them along with it.
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
        style={[{ position: "absolute", zIndex: Z.edge }, place]}
      />
    </GestureDetector>
  );
}
