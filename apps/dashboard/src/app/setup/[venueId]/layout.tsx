import type { components } from "@hagz/api";
import type { EntranceSide, VenueLayoutView } from "@hagz/contracts";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmenityIcon } from "@/components/amenity-icon";
import { useHud } from "@/components/hud";
import {
  IconCheck,
  IconChevronLeft,
  IconCopy,
  IconDoor,
  IconEye,
  IconEyeOff,
  IconList,
  IconMinus,
  IconPlus,
  IconRotate,
  IconTrash,
} from "@/components/icons";
import {
  AmenityArt,
  fitCamera,
  GroundArt,
  LayoutCanvas,
  NO_GHOST,
  PitchArt,
  useCamera,
  zoomAround,
  type Camera,
  nearestEdge,
  NO_ENTRANCE,
  SIDES,
  type EntranceSpot,
  type Ghost,
  type GhostState,
  type Grow,
  type Trouble,
} from "@/components/layout-canvas";
import { LayoutList, type ListedItem } from "@/components/layout-list";
import { SetupLoading } from "@/components/setup-loading";
import { Text } from "@/components/text";
import { FloatingButton, floatShadow } from "@/components/venue-map";
import { colors } from "@/lib/colors";
import { kindOf, type Ground } from "@/lib/grounds";
import {
  CELL,
  clashes,
  defaultFootprint,
  fitsIn,
  footprintOf,
  oriented,
  roomFor,
  type Rect,
  type Tile,
} from "@/lib/layout";
import { useLayoutEditor } from "@/lib/layout-editor";
import { queries, reference } from "@/lib/queries";

type Amenity = components["schemas"]["Amenity"];

// Setup item "Layout" (Figma "Layout", 376:2–378:2): the venue drawn to scale, full screen, with the
// grounds and amenities on it and what's still to place in a tray at the bottom. Tap something in
// the tray to put it in the middle of the view; tap a tile to select it and drag it into place.
// A selected ground can be turned, a selected amenity sized by its corners, and either taken off.
// Every change saves behind it (lib/layout-editor.ts).

// The tray: its padding, title and one row of 64-high chips.
const TRAY_HEIGHT = 132;
// Gliding to something picked from the list.
const GLIDE = { duration: 320 };

export default function SetupLayout() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const layout = useQuery(queries.layout(venueId));
  const grounds = useQuery(queries.grounds(venueId));
  const venue = useQuery(queries.venue(venueId));
  const options = useQuery({
    ...reference.amenities(venue.data?.marketplace.code ?? ""),
    enabled: Boolean(venue.data),
  });
  if (!layout.data) return <SetupLoading query={layout} />;
  if (!grounds.data) return <SetupLoading query={grounds} />;
  if (!venue.data) return <SetupLoading query={venue} />;
  if (!options.data) return <SetupLoading query={options} />;
  return (
    <LayoutView
      venueId={venueId}
      layout={layout.data}
      grounds={grounds.data}
      options={options.data}
    />
  );
}

function LayoutView({
  venueId,
  layout,
  grounds,
  options,
}: {
  venueId: string;
  layout: VenueLayoutView;
  grounds: Ground[];
  options: Amenity[];
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  // What the header and the tray leave of the screen, which the venue is first fitted into.
  const area = { top: insets.top + 8 + 44 + 14, bottom: insets.bottom + TRAY_HEIGHT + 16 };
  const camera = useCamera(fitCamera(layout, screen, area));
  const { plan, change } = useLayoutEditor(venueId, layout);
  const [selected, setSelected] = useState<string | null>(null);
  // What's being dragged out of the tray: where it would land lives on the UI thread, what it is
  // here.
  const ghostState = useSharedValue<GhostState>(NO_GHOST);
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const [listOpen, setListOpen] = useState(false);
  // An entrance being dragged out of the tray: the edge cell it would go on.
  const entranceSpot = useSharedValue<EntranceSpot>(NO_ENTRANCE);
  const [entranceLifted, setEntranceLifted] = useState(false);
  // Showing the layout as players will see it: nothing to edit, no tray.
  const [previewing, setPreviewing] = useState(false);
  // The venue's size while one of its edges is being dragged.
  const [sizing, setSizing] = useState<{ columns: number; rows: number } | null>(null);
  const trayFade = useAnimatedStyle(() => ({
    opacity: withTiming(previewing ? 0 : 1, { duration: 200 }),
  }));
  const [lifted, setLifted] = useState<{ key: string; art: React.ReactNode; name: string } | null>(
    null,
  );

  const groundsById = useMemo(() => new Map(grounds.map((g) => [g.id, g])), [grounds]);
  const amenitiesById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const nameOf = (ground: Ground) => ground.name ?? t("screens.setup.grounds.unnamed");

  // What's on the layout, as rectangles with names, for placing and for saying what's in the way.
  const tiles = useMemo<Tile[]>(
    () => [
      ...plan.grounds.flatMap((placed) => {
        const ground = groundsById.get(placed.groundId);
        if (!ground) return [];
        // Its own size, as it lies.
        const size = oriented(placed, placed.orientation);
        return [
          {
            key: `g:${placed.groundId}`,
            name: nameOf(ground),
            rect: { x: placed.x, y: placed.y, ...size },
          },
        ];
      }),
      ...plan.amenities.map((placed, index) => ({
        key: `a:${String(index)}`,
        name: amenitiesById.get(placed.optionId)?.name ?? "",
        rect: placed,
      })),
    ],
    // nameOf only reads t, which the grounds' names follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, groundsById, amenitiesById],
  );

  const onLayout = new Set(plan.grounds.map((placed) => placed.groundId));
  const unplaced = grounds.filter((ground) => !onLayout.has(ground.id));
  // The venue's amenities that can go on the layout. They stay in the tray once placed: a venue
  // can have two car parks.
  // Like the grounds, each leaves the tray once it's on the layout; another of it is added from
  // its action bar (Add another).
  const placedOptions = new Set(plan.amenities.map((placed) => placed.optionId));
  const placeable = layout.placeableOptionIds
    .filter((id) => !placedOptions.has(id))
    .flatMap((id) => amenitiesById.get(id) ?? []);
  const needsEntrance = plan.entrances.length === 0;
  const trayEmpty = unplaced.length === 0 && placeable.length === 0 && !needsEntrance;

  const middle = { x: screen.width / 2, y: (area.top + screen.height - area.bottom) / 2 };
  // The cell in the middle of what's on screen, where new things go.
  const middleCell = () => ({
    x: (middle.x - camera.x.value) / (CELL * camera.scale.value),
    y: (middle.y - camera.y.value) / (CELL * camera.scale.value),
  });

  const trouble = (found: Trouble) => {
    if (!found) return;
    hud.show(
      found.outside
        ? t("screens.setup.layout.outside")
        : t("screens.setup.layout.overlaps", {
            names: listOf(found.names, t("screens.setup.layout.and")),
          }),
    );
  };

  const placeGround = (ground: Ground) => {
    for (const orientation of ["HORIZONTAL", "VERTICAL"] as const) {
      const spot = roomFor(
        footprintOf(ground, orientation),
        tiles,
        plan.columns,
        plan.rows,
        middleCell(),
      );
      if (!spot) continue;
      change({
        ...plan,
        grounds: [
          ...plan.grounds,
          { groundId: ground.id, ...spot, orientation, ...defaultFootprint(ground) },
        ],
      });
      setSelected(`g:${ground.id}`);
      return;
    }
    hud.show(t("screens.setup.layout.noRoom"));
  };

  const placeAmenity = (amenity: Amenity) => {
    for (const size of [NEW_AMENITY, { width: 1, height: 1 }]) {
      const spot = roomFor(size, tiles, plan.columns, plan.rows, middleCell());
      if (!spot) continue;
      change({
        ...plan,
        amenities: [...plan.amenities, { optionId: amenity.id, ...spot, ...size }],
      });
      setSelected(`a:${String(plan.amenities.length)}`);
      return;
    }
    hud.show(t("screens.setup.layout.noRoom"));
  };

  // A new entrance goes on the bottom edge, as near its middle as is free, then the other sides.
  // Or, for another beside one already there, on its side as near it as is free.
  const placeEntrance = (near?: { side: EntranceSide; offset: number }) => {
    const taken = new Set(plan.entrances.map((e) => `${e.side}:${String(e.offset)}`));
    const sides: EntranceSide[] = ["BOTTOM", "TOP", "LEFT", "RIGHT"];
    for (const side of near ? [near.side, ...sides.filter((s) => s !== near.side)] : sides) {
      const length = side === "TOP" || side === "BOTTOM" ? plan.columns : plan.rows;
      const target = near && side === near.side ? near.offset : (length - 1) / 2;
      const offsets = Array.from({ length }, (_, i) => i).sort(
        (a, b) => Math.abs(a - target) - Math.abs(b - target),
      );
      const offset = offsets.find((o) => !taken.has(`${side}:${String(o)}`));
      if (offset === undefined) continue;
      change({ ...plan, entrances: [...plan.entrances, { side, offset }] });
      setSelected(`e:${String(plan.entrances.length)}`);
      return;
    }
    hud.show(t("screens.setup.layout.noRoom"));
  };

  // Another of a placed amenity, the same size, in the free spot nearest it.
  const addAnotherAmenity = (index: number) => {
    const original = plan.amenities[index];
    if (!original) return;
    const near = {
      x: original.x + original.width / 2,
      y: original.y + original.height / 2,
    };
    const spot = roomFor(original, tiles, plan.columns, plan.rows, near);
    if (!spot) return hud.show(t("screens.setup.layout.noRoom"));
    change({ ...plan, amenities: [...plan.amenities, { ...original, ...spot }] });
    setSelected(`a:${String(plan.amenities.length)}`);
  };

  // An entrance dragged out of the tray onto an edge cell (the drag has checked it's free).
  const dropEntrance = (side: EntranceSide, offset: number) => {
    change({ ...plan, entrances: [...plan.entrances, { side, offset }] });
    setSelected(`e:${String(plan.entrances.length)}`);
  };

  // Dropped from the tray onto a free spot (the drag has checked it): there it goes, selected.
  const dropGround = (ground: Ground, x: number, y: number) => {
    change({
      ...plan,
      grounds: [
        ...plan.grounds,
        { groundId: ground.id, x, y, orientation: "HORIZONTAL", ...defaultFootprint(ground) },
      ],
    });
    setSelected(`g:${ground.id}`);
  };
  const dropAmenity = (amenity: Amenity, x: number, y: number) => {
    change({
      ...plan,
      amenities: [...plan.amenities, { optionId: amenity.id, x, y, ...NEW_AMENITY }],
    });
    setSelected(`a:${String(plan.amenities.length)}`);
  };
  const trayTop = screen.height - insets.bottom - TRAY_HEIGHT;
  const drag = {
    camera,
    ghost: ghostState,
    gx: ghostX,
    gy: ghostY,
    tiles,
    columns: plan.columns,
    rows: plan.rows,
    trayTop,
    onTrouble: trouble,
    onLand: () => setLifted(null),
  };

  // An edge moved: the grid grows or shrinks on that side. Moving the left or top edge moves the
  // grid's start, so everything placed shifts by as much to stay where it is.
  const resizeVenue = (grow: Grow) => {
    change({
      columns: plan.columns + grow.left + grow.right,
      rows: plan.rows + grow.top + grow.bottom,
      grounds: plan.grounds.map((g) => ({ ...g, x: g.x + grow.left, y: g.y + grow.top })),
      amenities: plan.amenities.map((a) => ({ ...a, x: a.x + grow.left, y: a.y + grow.top })),
      entrances: plan.entrances.map((e) => ({
        ...e,
        offset: e.offset + (e.side === "TOP" || e.side === "BOTTOM" ? grow.left : grow.top),
      })),
    });
  };

  const move = (key: string, x: number, y: number) => {
    const [kind, id] = split(key);
    if (kind === "g") {
      change({
        ...plan,
        grounds: plan.grounds.map((g) => (g.groundId === id ? { ...g, x, y } : g)),
      });
    } else {
      const index = Number(id);
      change({
        ...plan,
        amenities: plan.amenities.map((a, i) => (i === index ? { ...a, x, y } : a)),
      });
    }
  };

  // Sized by its grip: an amenity takes the new rect; a ground its new length and breadth (stored
  // landscape, so a VERTICAL one turns back), and its top-left stays put.
  const resize = (key: string, rect: Rect) => {
    const [kind, id] = split(key);
    if (kind === "g") {
      change({
        ...plan,
        grounds: plan.grounds.map((g) =>
          g.groundId === id ? { ...g, ...oriented(rect, g.orientation) } : g,
        ),
      });
      return;
    }
    const index = Number(id);
    change({
      ...plan,
      amenities: plan.amenities.map((a, i) => (i === index ? { ...a, ...rect } : a)),
    });
  };

  // Turned where it stands; refused, saying why, if that doesn't fit.
  const rotate = (groundId: string) => {
    const placed = plan.grounds.find((g) => g.groundId === groundId);
    const ground = groundsById.get(groundId);
    if (!placed || !ground) return;
    const orientation = placed.orientation === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL";
    // Its own length and breadth, turned.
    const rect = { x: placed.x, y: placed.y, ...oriented(placed, orientation) };
    if (!fitsIn(rect, plan.columns, plan.rows)) return trouble({ outside: true });
    const hits = clashes(rect, tiles, `g:${groundId}`);
    if (hits.length) return trouble({ outside: false, names: hits.map((h) => h.name) });
    change({
      ...plan,
      grounds: plan.grounds.map((g) => (g.groundId === groundId ? { ...g, orientation } : g)),
    });
  };

  const remove = (key: string) => {
    const [kind, id] = split(key);
    const index = Number(id);
    setSelected(null);
    if (kind === "g") change({ ...plan, grounds: plan.grounds.filter((g) => g.groundId !== id) });
    if (kind === "a") change({ ...plan, amenities: plan.amenities.filter((_, i) => i !== index) });
    if (kind === "e") change({ ...plan, entrances: plan.entrances.filter((_, i) => i !== index) });
  };

  // Glides the map so a rect sits in the middle of the view, at the zoom it's at.
  const focusOn = (rect: Rect) => {
    const s = camera.scale.value * CELL;
    camera.x.value = withTiming(middle.x - (rect.x + rect.width / 2) * s, GLIDE);
    camera.y.value = withTiming(middle.y - (rect.y + rect.height / 2) * s, GLIDE);
  };

  // The list sheet's rows: what's on the layout, by kind.
  const listed: { title: string; items: ListedItem[] }[] = [
    {
      title: t("screens.setup.layout.grounds"),
      items: plan.grounds.flatMap((placed) => {
        const ground = groundsById.get(placed.groundId);
        if (!ground) return [];
        return [
          {
            key: `g:${placed.groundId}`,
            icon: <PitchArt width={44} height={22} inset={3} line={1.1} radius={4} />,
            name: nameOf(ground),
            detail: kindOf(t, ground),
          },
        ];
      }),
    },
    {
      title: t("screens.setup.layout.amenities"),
      items: plan.amenities.flatMap((placed, index) => {
        const amenity = amenitiesById.get(placed.optionId);
        if (!amenity) return [];
        return [
          {
            key: `a:${String(index)}`,
            icon: <AmenityIcon name={amenity.icon} size={24} color={colors.ink} />,
            name: amenity.name,
            detail: t("screens.setup.layout.size", {
              width: placed.width,
              height: placed.height,
            }),
          },
        ];
      }),
    },
    {
      title: t("screens.setup.layout.entrances"),
      items: plan.entrances.map((entrance, index) => ({
        key: `e:${String(index)}`,
        icon: <IconDoor size={24} color={colors.ink} strokeWidth={1.75} />,
        name: t("screens.setup.layout.entrance"),
        detail: t(`screens.setup.layout.sides.${entrance.side}`),
      })),
    },
  ];

  // The selected thing's rect in cells, to hang its actions under.
  // Where something is, in cells, by its key; an entrance is a cell-long line on its edge.
  function rectOf(key: string): Rect | null {
    const tile = tiles.find((candidate) => candidate.key === key);
    if (tile) return tile.rect;
    const entrance = plan.entrances[Number(split(key)[1])];
    if (!entrance || split(key)[0] !== "e") return null;
    const along = entrance.offset;
    const horizontal = entrance.side === "TOP" || entrance.side === "BOTTOM";
    const x = horizontal ? along : entrance.side === "LEFT" ? 0 : plan.columns;
    const y = horizontal ? (entrance.side === "TOP" ? 0 : plan.rows) : along;
    return { x, y, width: horizontal ? 1 : 0, height: horizontal ? 0 : 1 };
  }
  const selectedRect = selected ? rectOf(selected) : null;
  const [kind, id] = selected ? split(selected) : [null, null];
  const selectedAmenity = kind === "a" ? plan.amenities[Number(id)] : undefined;

  return (
    <View className="flex-1 bg-field">
      <StatusBar style="dark" />
      <LayoutCanvas
        layout={plan}
        grounds={groundsById}
        amenities={amenitiesById}
        camera={camera}
        screen={screen}
        ghost={
          lifted
            ? ({
                state: ghostState,
                gx: ghostX,
                gy: ghostY,
                art: lifted.art,
                name: lifted.name,
              } satisfies Ghost)
            : null
        }
        entranceGhost={entranceLifted ? entranceSpot : null}
        editing={{
          readOnly: previewing,
          onSizing: setSizing,
          onResizeVenue: resizeVenue,
          tiles,
          selected,
          onSelect: setSelected,
          onMove: move,
          onResize: resize,
          onMoveEntrance: (index, side, offset) =>
            change({
              ...plan,
              entrances: plan.entrances.map((e, i) => (i === index ? { side, offset } : e)),
            }),
        }}
      />

      {selected && selectedRect && !previewing ? (
        <Actions camera={camera} rect={selectedRect} screen={screen} area={area}>
          {kind === "g" && id ? (
            <ActionButton label={t("screens.setup.layout.rotate")} onPress={() => rotate(id)}>
              <IconRotate size={24} color={colors.white} strokeWidth={1.75} />
            </ActionButton>
          ) : null}
          {selectedAmenity ? (
            <Text className="px-2.5 text-[15px] font-medium text-white">
              {t("screens.setup.layout.size", {
                width: selectedAmenity.width,
                height: selectedAmenity.height,
              })}
            </Text>
          ) : null}
          {kind === "a" || kind === "e" ? (
            <ActionButton
              label={t("screens.setup.layout.addAnother")}
              onPress={() => {
                if (kind === "a") return addAnotherAmenity(Number(id));
                const entrance = plan.entrances[Number(id)];
                if (entrance) placeEntrance(entrance);
              }}
            >
              <IconCopy size={22} color={colors.white} strokeWidth={1.75} />
            </ActionButton>
          ) : null}
          <ActionButton label={t("screens.setup.layout.remove")} onPress={() => remove(selected)}>
            <IconTrash size={24} color={colors.white} strokeWidth={1.75} />
          </ActionButton>
          <ActionButton label={t("screens.setup.layout.done")} onPress={() => setSelected(null)}>
            <IconCheck size={24} color={colors.white} strokeWidth={2} />
          </ActionButton>
        </Actions>
      ) : null}

      {/* Back, what this is and how far along, and a preview of what players see. */}
      <View
        className="absolute inset-x-5 flex-row items-center justify-between"
        style={{ top: insets.top + 8 }}
      >
        <FloatingButton label={t("components.shared.nav.back")} onPress={() => router.back()}>
          <IconChevronLeft size={22} color={colors.ink} strokeWidth={2} />
        </FloatingButton>
        <View
          className="h-11 items-center justify-center rounded-full bg-white px-[18px]"
          style={floatShadow}
        >
          <Text className="text-[15px] font-semibold leading-[18px]">
            {t("screens.setup.items.LAYOUT.title")}
          </Text>
          <Text className="text-[12px] leading-[15px] text-ink-2">
            {sizing
              ? t("screens.setup.layout.sizing", {
                  ...sizing,
                  // A cell is about 10 m.
                  width: sizing.columns * 10,
                  length: sizing.rows * 10,
                })
              : previewing
                ? t("screens.setup.layout.previewing")
                : t("screens.setup.layout.placed", {
                    placed: plan.grounds.length,
                    count: grounds.length,
                  })}
          </Text>
        </View>
        <FloatingButton
          label={t(previewing ? "screens.setup.layout.editLayout" : "screens.setup.layout.preview")}
          onPress={() => {
            setSelected(null);
            setPreviewing(!previewing);
          }}
        >
          {previewing ? (
            <IconEyeOff size={24} color={colors.ink} strokeWidth={1.75} />
          ) : (
            <IconEye size={24} color={colors.ink} strokeWidth={1.75} />
          )}
        </FloatingButton>
      </View>

      {/* Zoom, and the list of what's on the layout, at the right edge. */}
      <View
        className="absolute right-5 items-center gap-5"
        style={{ top: middle.y - 66 }}
        pointerEvents="box-none"
      >
        <View
          className="w-11 items-center gap-2.5 rounded-full bg-white py-2.5"
          style={floatShadow}
        >
          <ZoomButton
            label={t("screens.setup.layout.zoomIn")}
            onPress={() => zoomAround(camera, 1.5, middle)}
          >
            <IconPlus size={24} color={colors.ink} strokeWidth={1.75} />
          </ZoomButton>
          <View className="h-px w-5 bg-border" />
          <ZoomButton
            label={t("screens.setup.layout.zoomOut")}
            onPress={() => zoomAround(camera, 1 / 1.5, middle)}
          >
            <IconMinus size={24} color={colors.ink} strokeWidth={1.75} />
          </ZoomButton>
        </View>
        {previewing ? null : (
          <FloatingButton label={t("screens.setup.layout.list")} onPress={() => setListOpen(true)}>
            <IconList size={24} color={colors.ink} strokeWidth={1.75} />
          </FloatingButton>
        )}
      </View>

      {/* What's still to place: grounds not on the layout, the venue's amenities, entrances. Tap
          one to put it in the middle of the view, then drag it into place. It fades out for the
          preview. */}
      <Animated.View
        pointerEvents={previewing ? "none" : "auto"}
        className="absolute inset-x-3 rounded-[24px] bg-white py-[18px] pl-[18px]"
        style={[
          {
            bottom: insets.bottom,
            height: TRAY_HEIGHT,
            shadowColor: colors.ink,
            shadowOpacity: 0.14,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
          },
          trayFade,
        ]}
      >
        <Text className="pb-3 text-[16px] font-medium">{t("screens.setup.layout.notPlaced")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 18 }}
        >
          {unplaced.map((ground) => {
            const key = `g:${ground.id}`;
            const size = footprintOf(ground, "HORIZONTAL");
            return (
              <TrayItem
                key={key}
                label={nameOf(ground)}
                size={size}
                lifted={lifted?.key === key}
                onTap={() => placeGround(ground)}
                onLift={() =>
                  setLifted({
                    key,
                    name: nameOf(ground),
                    art: (
                      <GroundArt
                        name={nameOf(ground)}
                        width={size.width * CELL}
                        height={size.height * CELL}
                      />
                    ),
                  })
                }
                onDrop={(x, y) => dropGround(ground, x, y)}
                {...drag}
              >
                <GroundChip ground={ground} />
              </TrayItem>
            );
          })}
          {placeable.map((amenity) => {
            const key = `a:${amenity.id}`;
            return (
              <TrayItem
                key={key}
                label={amenity.name}
                size={NEW_AMENITY}
                lifted={lifted?.key === key}
                onTap={() => placeAmenity(amenity)}
                onLift={() =>
                  setLifted({
                    key,
                    name: amenity.name,
                    art: (
                      <AmenityArt
                        amenity={amenity}
                        width={NEW_AMENITY.width * CELL}
                        height={NEW_AMENITY.height * CELL}
                      />
                    ),
                  })
                }
                onDrop={(x, y) => dropAmenity(amenity, x, y)}
                {...drag}
              >
                <Chip
                  icon={<AmenityIcon name={amenity.icon} size={24} color={colors.ink} />}
                  label={amenity.name}
                />
              </TrayItem>
            );
          })}
          {/* An entrance goes on an edge rather than in a cell: dragged out, it snaps to the
              nearest edge cell. */}
          {needsEntrance ? (
            <EntranceTrayItem
              label={t("screens.setup.layout.entrance")}
              camera={camera}
              spot={entranceSpot}
              columns={plan.columns}
              rows={plan.rows}
              taken={plan.entrances.map(
                (e) => `${String(SIDES.indexOf(e.side))}:${String(e.offset)}`,
              )}
              trayTop={trayTop}
              lifted={entranceLifted}
              onTap={() => placeEntrance()}
              onLift={() => setEntranceLifted(true)}
              onDrop={(side, offset) => {
                const named = SIDES[side];
                if (named) dropEntrance(named, offset);
              }}
              onLand={() => setEntranceLifted(false)}
            >
              <Chip
                icon={<IconDoor size={24} color={colors.ink} strokeWidth={1.75} />}
                label={t("screens.setup.layout.entrance")}
              />
            </EntranceTrayItem>
          ) : null}
          {trayEmpty ? (
            <Text className="self-center text-body text-ink-2">
              {t("screens.setup.layout.allPlaced")}
            </Text>
          ) : null}
        </ScrollView>
      </Animated.View>

      <LayoutList
        visible={listOpen}
        groups={listed}
        onClose={() => setListOpen(false)}
        onPick={(key) => {
          setListOpen(false);
          setSelected(key);
          const rect = rectOf(key);
          if (rect) focusOn(rect);
        }}
      />
    </View>
  );
}

// Something let go over the map gliding into its cells before it's placed.
const LAND = { duration: 200 };

// An amenity starts at two cells by two; its corners size it from there.
const NEW_AMENITY = { width: 2, height: 2 };

// One thing in the tray. Tap it and it goes in the middle of the view; drag it up out of the tray
// (Figma 378:2) and it follows the finger over the map a cell at a time, drawn where it would land:
// as itself where it fits, dashed with the HUD saying why where it doesn't. Let go somewhere it
// fits and it's placed there. A sideways swipe still scrolls the tray: the drag starts only when
// the finger heads up or down first.
function TrayItem({
  label,
  size,
  lifted,
  camera,
  ghost,
  gx,
  gy,
  tiles,
  columns,
  rows,
  trayTop,
  onTap,
  onLift,
  onDrop,
  onTrouble,
  onLand,
  children,
}: {
  label: string;
  // Its size in cells, or null when it can't be dragged (an entrance).
  size: { width: number; height: number } | null;
  lifted: boolean;
  camera: Camera;
  ghost: SharedValue<GhostState>;
  gx: SharedValue<number>;
  gy: SharedValue<number>;
  tiles: Tile[];
  columns: number;
  rows: number;
  trayTop: number;
  onTap: () => void;
  onLift: () => void;
  onDrop: (x: number, y: number) => void;
  onTrouble: (trouble: Trouble) => void;
  onLand: () => void;
  children: React.ReactNode;
}) {
  const said = useSharedValue("");
  // Let go where it fits: it glides into its cells, and only then is it placed.
  const gliding = useSharedValue(false);
  const width = size?.width ?? 1;
  const height = size?.height ?? 1;
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)();
  });
  const drag = Gesture.Pan()
    .enabled(size !== null)
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onStart(() => {
      camera.busy.value = true;
      runOnJS(onLift)();
    })
    .onUpdate((event) => {
      // Back over the tray: nowhere to land.
      if (event.absoluteY > trayTop) {
        ghost.value = { ...ghost.value, shown: false };
        return;
      }
      // Its middle under the finger, in points on the map; the cells it would land on, nearest.
      gx.value = (event.absoluteX - camera.x.value) / camera.scale.value - (width * CELL) / 2;
      gy.value = (event.absoluteY - camera.y.value) / camera.scale.value - (height * CELL) / 2;
      const x = Math.round(gx.value / CELL);
      const y = Math.round(gy.value / CELL);
      const rect = { x, y, width, height };
      const outside = !fitsIn(rect, columns, rows);
      const hits = outside ? [] : clashes(rect, tiles, "").map((tile) => tile.name);
      ghost.value = { shown: true, ...rect, blocked: outside || hits.length > 0 };
      const words = outside ? "outside" : hits.join("|");
      if (words === said.value) return;
      said.value = words;
      runOnJS(onTrouble)(
        outside ? { outside: true } : hits.length ? { outside: false, names: hits } : null,
      );
    })
    .onEnd(() => {
      const landed = ghost.value;
      if (!landed.shown || landed.blocked) return;
      gliding.value = true;
      gy.value = withTiming(landed.y * CELL, LAND);
      gx.value = withTiming(landed.x * CELL, LAND, () => {
        gliding.value = false;
        ghost.value = { ...ghost.value, shown: false };
        runOnJS(onDrop)(landed.x, landed.y);
        runOnJS(onLand)();
      });
    })
    .onFinalize(() => {
      camera.busy.value = false;
      said.value = "";
      if (gliding.value) return;
      ghost.value = { ...ghost.value, shown: false };
      runOnJS(onLand)();
    });

  return (
    <GestureDetector gesture={Gesture.Race(drag, tap)}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        onAccessibilityTap={onTap}
        // Picked up: blue, like the frame's chip.
        className={`rounded-[16px] border ${lifted ? "border-primary bg-blue-tint" : "border-border bg-white"}`}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

// The Entrance chip: tap it and it goes on the bottom edge; drag it up out of the tray and it snaps
// to the free edge cell nearest the finger, shown as its tag, and goes there when let go.
function EntranceTrayItem({
  label,
  camera,
  spot,
  columns,
  rows,
  taken,
  trayTop,
  lifted,
  onTap,
  onLift,
  onDrop,
  onLand,
  children,
}: {
  label: string;
  camera: Camera;
  spot: SharedValue<EntranceSpot>;
  columns: number;
  rows: number;
  taken: string[];
  trayTop: number;
  lifted: boolean;
  onTap: () => void;
  onLift: () => void;
  onDrop: (side: number, offset: number) => void;
  onLand: () => void;
  children: React.ReactNode;
}) {
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)();
  });
  const drag = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onStart(() => {
      camera.busy.value = true;
      runOnJS(onLift)();
    })
    .onUpdate((event) => {
      if (event.absoluteY > trayTop) {
        spot.value = { ...spot.value, shown: false };
        return;
      }
      const x = (event.absoluteX - camera.x.value) / camera.scale.value;
      const y = (event.absoluteY - camera.y.value) / camera.scale.value;
      const at = nearestEdge(x, y, columns, rows, taken);
      if (at) spot.value = { shown: true, ...at };
    })
    .onEnd(() => {
      const at = spot.value;
      if (at.shown) runOnJS(onDrop)(at.side, at.offset);
    })
    .onFinalize(() => {
      camera.busy.value = false;
      spot.value = { ...spot.value, shown: false };
      runOnJS(onLand)();
    });
  return (
    <GestureDetector gesture={Gesture.Race(drag, tap)}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        onAccessibilityTap={onTap}
        className={`rounded-[16px] border ${lifted ? "border-primary bg-blue-tint" : "border-border bg-white"}`}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

// "g:<groundId>", "a:<index>" or "e:<index>": what kind of thing, and which.
const split = (key: string) => {
  const at = key.indexOf(":");
  return [key.slice(0, at), key.slice(at + 1)] as const;
};

// "Pitch 4 and Café", "Pitch 1, Pitch 2 and Café".
const listOf = (names: string[], and: string) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1] ?? ""}`;

// The black bar of actions under what's selected (Figma 376:2, 377:2). It follows the map as it
// moves and zooms, goes above the thing when there's no room under it, and hides while something
// is being dragged.
function Actions({
  camera,
  rect,
  screen,
  area,
  children,
}: {
  camera: Camera;
  rect: Rect;
  screen: { width: number; height: number };
  area: { top: number; bottom: number };
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const s = camera.scale.value * CELL;
    const left = camera.x.value + rect.x * s;
    const below = camera.y.value + (rect.y + rect.height) * s + 12;
    const above = camera.y.value + rect.y * s - 12 - 40;
    const top = below + 40 > screen.height - area.bottom ? above : below;
    return {
      left: Math.min(Math.max(12, left), screen.width - 12 - 170),
      top: Math.max(area.top, top),
      opacity: camera.busy.value ? 0 : 1,
    };
  });
  return (
    <Animated.View
      // Only its buttons take touches: a tap on the tile it covers goes through to that tile.
      pointerEvents="box-none"
      className="absolute h-10 flex-row items-center gap-0.5 rounded-full bg-ink px-1.5"
      style={[
        {
          shadowColor: colors.ink,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function ActionButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-10 items-center justify-center active:opacity-60"
    >
      {children}
    </Pressable>
  );
}

// One of the zoom pair: a bare icon, since the two share one round white button.
function ZoomButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="active:opacity-60"
    >
      {children}
    </Pressable>
  );
}

// A ground waiting for its place: a small pitch, its name, and what it is ("5-a-side").
function GroundChip({ ground }: { ground: Ground }) {
  const { t } = useTranslation();
  const kind =
    ground.size === "STANDARD"
      ? t(`screens.setup.grounds.sports.${ground.sport}`)
      : t(`screens.setup.grounds.sizes.${ground.size}`);
  return (
    <View className="h-16 flex-row items-center gap-2.5 pl-3 pr-3.5">
      <PitchArt width={44} height={22} inset={3} line={1.1} radius={4} />
      <View>
        <Text className="text-[15px] font-medium" numberOfLines={1}>
          {ground.name ?? t("screens.setup.grounds.unnamed")}
        </Text>
        <Text className="text-[13px] text-ink-2">{kind}</Text>
      </View>
    </View>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="h-16 flex-row items-center gap-2.5 pl-3 pr-3.5">
      {icon}
      <Text className="text-[15px] font-medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
