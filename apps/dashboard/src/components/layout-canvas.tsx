import type { components } from "@hagz/api";
import type { EntranceSide, VenueLayout } from "@hagz/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import type { Ground } from "@/lib/grounds";
import { CELL, footprintOf } from "@/lib/layout";
import { AmenityIcon } from "./amenity-icon";
import { IconArrowDown } from "./icons";
import { Text } from "./text";

type Amenity = components["schemas"]["Amenity"];

// The venue layout drawn to scale and moved with the fingers (Figma "Layout", 376:2): a grid that
// runs past the venue across the whole screen, the venue's outline in ink, its grounds as blue
// pitches with their names, its amenities as grey tiles, and its entrances as black tags on the
// edge. Drag to move, pinch to zoom.
//
// Everything sits in one "world" view, a cell CELL points at zoom 1, which the gestures move and
// scale; nothing inside re-renders while they do. The grid lines are thin plain views rather than
// one big SVG: an SVG's bitmap grows with its size times the zoom, and would run to hundreds of MB.

const ZOOM = { duration: 220 };
// How much of the venue must stay on screen while it's dragged about.
const KEEP = 60;

export interface Camera {
  scale: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
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
  return { scale, x, y, min: start.min, max: start.max };
}

// Zooms by `factor` around a point on screen (the middle, for the + and − buttons).
export const zoomAround = (camera: Camera, factor: number, focus: { x: number; y: number }) => {
  const next = Math.min(camera.max, Math.max(camera.min, camera.scale.value * factor));
  const applied = next / camera.scale.value;
  camera.x.value = withTiming(focus.x - (focus.x - camera.x.value) * applied, ZOOM);
  camera.y.value = withTiming(focus.y - (focus.y - camera.y.value) * applied, ZOOM);
  camera.scale.value = withTiming(next, ZOOM);
};

export function LayoutCanvas({
  layout,
  grounds,
  amenities,
  camera,
  screen,
}: {
  layout: VenueLayout;
  grounds: Map<string, Ground>;
  amenities: Map<string, Amenity>;
  camera: Camera;
  screen: { width: number; height: number };
}) {
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
    .onStart(() => {
      panned.value = { x: 0, y: 0 };
    })
    .onUpdate((event) => {
      camera.x.value += event.translationX - panned.value.x;
      camera.y.value += event.translationY - panned.value.y;
      panned.value = { x: event.translationX, y: event.translationY };
      keepOnScreen();
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinched.value = 1;
    })
    .onUpdate((event) => {
      const factor = event.scale / pinched.value;
      pinched.value = event.scale;
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

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
      <View className="absolute inset-0 overflow-hidden bg-field">
        <Animated.View
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
            const size = footprintOf(ground, placed.orientation);
            return (
              <GroundTile
                key={placed.groundId}
                ground={ground}
                left={placed.x * CELL}
                top={placed.y * CELL}
                width={size.width * CELL}
                height={size.height * CELL}
              />
            );
          })}
          {layout.amenities.map((placed, index) => {
            const amenity = amenities.get(placed.optionId);
            if (!amenity) return null;
            return (
              <AmenityTile
                key={`${placed.optionId}-${String(index)}`}
                amenity={amenity}
                left={placed.x * CELL}
                top={placed.y * CELL}
                columns={placed.width}
                rows={placed.height}
              />
            );
          })}
          {layout.entrances.map((entrance) => (
            <EntranceTag
              key={`${entrance.side}-${String(entrance.offset)}`}
              side={entrance.side}
              offset={entrance.offset}
              width={width}
              height={height}
            />
          ))}
        </Animated.View>
      </View>
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

function GroundTile({
  ground,
  left,
  top,
  width,
  height,
}: {
  ground: Ground;
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ position: "absolute", left, top, width, height }}>
      <PitchArt width={width} height={height} />
      <View className="absolute inset-0 items-center justify-center">
        <View className="max-w-full rounded-[8px] bg-white px-[7px] py-[2px]">
          <Text className="text-[12px] font-medium" numberOfLines={1}>
            {ground.name ?? t("screens.setup.grounds.unnamed")}
          </Text>
        </View>
      </View>
    </View>
  );
}

// A grey tile with the amenity's icon, and its name when there's room for it (three cells by two,
// like the frames' café).
function AmenityTile({
  amenity,
  left,
  top,
  columns,
  rows,
}: {
  amenity: Amenity;
  left: number;
  top: number;
  columns: number;
  rows: number;
}) {
  const named = columns >= 3 && rows >= 2;
  const roomy = columns >= 2 && rows >= 2;
  return (
    <View
      className="items-center justify-center gap-0.5 overflow-hidden rounded-[6px] border border-chip-line bg-chip"
      style={{ position: "absolute", left, top, width: columns * CELL, height: rows * CELL }}
    >
      <AmenityIcon name={amenity.icon} size={roomy ? 24 : 14} color={colors.ink2} />
      {named ? (
        <Text className="text-[11px] font-medium text-ink-2" numberOfLines={1}>
          {amenity.name}
        </Text>
      ) : null}
    </View>
  );
}

// The arrow points out through the side the entrance is on.
const ARROW_TURN: Record<EntranceSide, string> = {
  BOTTOM: "0deg",
  TOP: "180deg",
  LEFT: "90deg",
  RIGHT: "-90deg",
};

// A black tag centred on the venue's edge, at the middle of its cell.
function EntranceTag({
  side,
  offset,
  width,
  height,
}: {
  side: EntranceSide;
  offset: number;
  width: number;
  height: number;
}) {
  const { t } = useTranslation();
  const along = (offset + 0.5) * CELL;
  const centre =
    side === "TOP"
      ? { x: along, y: 0 }
      : side === "BOTTOM"
        ? { x: along, y: height }
        : side === "LEFT"
          ? { x: 0, y: along }
          : { x: width, y: along };
  return (
    <View
      pointerEvents="none"
      className="items-center justify-center"
      style={{
        position: "absolute",
        left: centre.x - 60,
        top: centre.y - 12,
        width: 120,
        height: 24,
      }}
    >
      <View className="h-6 flex-row items-center gap-1 rounded-full bg-ink pl-1 pr-2">
        <View style={{ transform: [{ rotate: ARROW_TURN[side] }] }}>
          <IconArrowDown size={14} color={colors.white} strokeWidth={2} />
        </View>
        <Text className="text-[11px] font-medium text-white">
          {t("screens.setup.layout.entrance")}
        </Text>
      </View>
    </View>
  );
}
