import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { components } from "@hagz/api";
import { MAXIMUM_VENUE_PHOTOS, MINIMUM_VENUE_PHOTOS } from "@hagz/contracts";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import {
  IconCamera,
  IconPhoto,
  IconPhotoPlus,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api, reachable } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { preparePhoto, putPhoto } from "@/lib/photos";
import { afterVenueWrite, queries } from "@/lib/queries";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Setup item "Photos" (Figma "Photos · 1 Empty (grey)", 366:2, and "· 2 Added (grey, smaller
// radius)", 367:2). At least three, up to twenty; the first is the cover, drawn full width above
// the rest. Each photo is resized in the app and uploaded straight to storage, showing how far it's
// got, and joins the grid once the API has confirmed it (lib/photos.ts).
//
// Hold a photo and drag it to put it in order; tap one to make it the cover or remove it. The new
// order shows at once and is saved behind it.
type Photo = components["schemas"]["VenuePhoto"];
type Upload = { key: string; uri: string; progress: number };

const GAP = 8;
// Figma 367:2: the cover 345 × 196, the grid's photos 168 × 120.
const COVER_RATIO = 196 / 345;
const TILE_RATIO = 120 / 168;
const LIFT = 1.04;

interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where the nth tile goes: the first across the top, the rest two to a row under it. A worklet, so
// a drag can work out places on the UI thread without waiting on React.
const slotAt = (index: number, width: number): Slot => {
  "worklet";
  const coverHeight = Math.round(width * COVER_RATIO);
  if (index === 0) return { x: 0, y: 0, width, height: coverHeight };
  const tileWidth = (width - GAP) / 2;
  const tileHeight = Math.round(tileWidth * TILE_RATIO);
  const column = (index - 1) % 2;
  const row = Math.floor((index - 1) / 2);
  return {
    x: column * (tileWidth + GAP),
    y: coverHeight + GAP + row * (tileHeight + GAP),
    width: tileWidth,
    height: tileHeight,
  };
};

const layoutFor = (count: number, width: number) => {
  const slots = Array.from({ length: count }, (_, index) => slotAt(index, width));
  const last = slots[count - 1];
  return { slots, height: last ? last.y + last.height : 0 };
};

// The place a photo carried to (x, y) would take among the first `count`: the one it's over, or
// the nearest when it's over a gap or past the edge.
const placeAt = (x: number, y: number, count: number, width: number) => {
  "worklet";
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < count; index++) {
    const slot = slotAt(index, width);
    if (x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
      return index;
    }
    const distance = Math.hypot(slot.x + slot.width / 2 - x, slot.y + slot.height / 2 - y);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
};

function SetupPhotos() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const photos = useQuery(queries.photos(venueId));
  if (!photos.data) return <SetupLoading query={photos} />;
  return <PhotosGrid venueId={venueId} photos={photos.data} />;
}

function PhotosGrid({ venueId, photos }: { venueId: string; photos: Photo[] }) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const compact = useCompactTitle();
  const { width: screen } = useWindowDimensions();
  const width = screen - 40;
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [choosingSource, setChoosingSource] = useState(false);
  // The source tapped in the sheet, opened once the sheet has gone: iOS won't present the system
  // picker while another modal (the sheet) is still on screen, and does nothing instead.
  const [source, setSource] = useState<"library" | "camera" | null>(null);
  const [chosen, setChosen] = useState<Photo | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Unconfirmed uploads from an earlier visit are swept by the API after a day; only ready ones count.
  const ready = photos
    .filter((photo) => photo.status === "READY")
    .sort((a, b) => a.position - b.position);
  const room = MAXIMUM_VENUE_PHOTOS - ready.length - uploads.length;
  const left = Math.max(MINIMUM_VENUE_PHOTOS - ready.length, 0);
  const tiles = ready.length + uploads.length + (room > 0 ? 1 : 0);
  const { slots, height } = layoutFor(tiles, width);

  // The order on screen, which a drag rearranges as it goes (the others make room, live), and the
  // photo being carried. They live on the UI thread so the grid moves with the finger, not a render
  // later; the saved order catches up here.
  const readyKey = ready.map((photo) => photo.id).join(",");
  const order = useSharedValue<string[]>(readyKey ? readyKey.split(",") : []);
  const carried = useSharedValue<string | null>(null);
  const gridWidth = useSharedValue(width);
  useEffect(() => {
    order.value = readyKey ? readyKey.split(",") : [];
  }, [readyKey, order]);
  useEffect(() => {
    gridWidth.value = width;
  }, [width, gridWidth]);

  const photosKey = queries.photos(venueId).queryKey;

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    const key = `${asset.assetId ?? asset.uri}-${Date.now()}`;
    const progress = (fraction: number) =>
      setUploads((now) =>
        now.map((item) => (item.key === key ? { ...item, progress: fraction } : item)),
      );
    setUploads((now) => [...now, { key, uri: asset.uri, progress: 0 }]);
    try {
      const prepared = await preparePhoto(asset);
      const requested = await send(
        api.POST("/v1/staff/venues/{venueId}/photos", {
          params: { path: { venueId } },
          body: { contentType: "image/jpeg", size: prepared.blob.size },
        }),
      );
      if (!requested.ok) throw requested.error;
      const { photo, upload: target } = requested.data;
      await putPhoto({ ...target, url: reachable(target.url) }, prepared.blob, progress);
      const confirmed = await send(
        api.POST("/v1/staff/venues/{venueId}/photos/{photoId}/confirm", {
          params: { path: { venueId, photoId: photo.id } },
          body: { preview: prepared.preview },
        }),
      );
      if (!confirmed.ok) throw confirmed.error;
      // Into the grid before the tile goes, so it doesn't blink out and back. The checklist and the
      // draft card count photos too, but once for the whole batch (openPicker), not per photo.
      await queryClient.invalidateQueries({ queryKey: photosKey, exact: true });
    } catch (error) {
      console.warn(error);
      hud.show(hudMessage(error));
    } finally {
      setUploads((now) => now.filter((item) => item.key !== key));
    }
  };

  const choose = (picked: "library" | "camera") => {
    setSource(picked);
    setChoosingSource(false);
  };

  const pick = async (source: "library" | "camera") => {
    try {
      await openPicker(source);
    } catch (error) {
      console.warn(error);
      hud.show(t("screens.setup.photos.pickerFailed"));
    }
  };

  const openPicker = async (source: "library" | "camera") => {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return hud.show(t("screens.setup.photos.cameraBlocked"));
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      // The picker hands over the original; it's resized here, once, with our own settings.
      exif: false,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({
            ...options,
            allowsMultipleSelection: true,
            selectionLimit: room,
            orderedSelection: true,
          });
    if (result.canceled) return;
    // One at a time keeps the order they were picked in and the phone's memory down.
    for (const asset of result.assets.slice(0, room)) await upload(asset);
    void afterVenueWrite(queryClient, venueId);
  };

  const reorder = async (ids: string[]) => {
    const previous = photos;
    // Shown at once; saved behind it.
    queryClient.setQueryData(
      photosKey,
      photos.map((photo) => {
        const position = ids.indexOf(photo.id);
        return position === -1 ? photo : { ...photo, position };
      }),
    );
    const result = await send(
      api.PUT("/v1/staff/venues/{venueId}/photos/order", {
        params: { path: { venueId } },
        body: { photoIds: ids },
      }),
    );
    if (!result.ok) {
      queryClient.setQueryData(photosKey, previous);
      hud.show(hudMessage(result.error));
      return;
    }
    // The order is already on screen. It can't finish an item, but it does count as changing the
    // photos when a review sent the venue back asking to, so the checklist is fetched again too.
    void afterVenueWrite(queryClient, venueId);
  };

  // The order a drag left on screen: saved if it changed. Uploads and the add tile aren't places
  // to drop, so a drag only ever moves ready photos among themselves.
  const drop = (ids: string[]) => {
    setDragging(false);
    if (ids.join(",") !== readyKey) void reorder(ids);
  };

  const remove = async (photo: Photo) => {
    setActionsOpen(false);
    const result = await send(
      api.DELETE("/v1/staff/venues/{venueId}/photos/{photoId}", {
        params: { path: { venueId, photoId: photo.id } },
      }),
    );
    if (!result.ok) return hud.show(hudMessage(result.error));
    // Out of the grid at once; the checklist (it may now be short of photos) and the draft card
    // follow.
    queryClient.setQueryData(photosKey, (list) => list?.filter((p) => p.id !== photo.id));
    void afterVenueWrite(queryClient, venueId);
  };

  const makeCover = (photo: Photo) => {
    setActionsOpen(false);
    void reorder([photo.id, ...ready.filter((other) => other.id !== photo.id).map((p) => p.id)]);
  };

  const empty = ready.length === 0 && uploads.length === 0;

  return (
    <Screen
      footer={
        <>
          {left > 0 ? (
            <Text className="text-center text-caption text-ink-2">
              {t("screens.setup.photos.left", { count: left })}
            </Text>
          ) : null}
          <Button
            label={t("screens.setup.photos.done")}
            disabled={left > 0 || uploads.length > 0}
            onPress={() => router.back()}
          />
        </>
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={t("screens.setup.items.PHOTOS.title")}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY} scrollEnabled={!dragging}>
        <Title
          subtitle={t(empty ? "screens.setup.photos.emptyBody" : "screens.setup.photos.body")}
          onTitleLayout={compact.onTitleLayout}
        >
          {t("screens.setup.items.PHOTOS.title")}
        </Title>

        {empty ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setChoosingSource(true)}
            className="h-[220px] items-center justify-center rounded-[12px] border border-dashed border-ink-3 bg-field px-10 active:opacity-70"
          >
            <IconPhotoPlus size={24} color={colors.ink} strokeWidth={1.75} />
            <Text className="mt-2.5 text-subtitle font-semibold">
              {t("screens.setup.photos.add")}
            </Text>
            <Text className="mt-1.5 text-center text-label text-ink-2">
              {t("screens.setup.photos.addBody")}
            </Text>
          </Pressable>
        ) : (
          <View style={{ height }}>
            <DropGap order={order} carried={carried} gridWidth={gridWidth} />
            {ready.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                index={index}
                width={width}
                order={order}
                carried={carried}
                gridWidth={gridWidth}
                onDragStart={() => setDragging(true)}
                onDrop={drop}
                onPress={() => {
                  setChosen(photo);
                  setActionsOpen(true);
                }}
              />
            ))}
            {uploads.map((item, index) => (
              <UploadTile key={item.key} upload={item} slot={slots[ready.length + index]} />
            ))}
            {room > 0 ? (
              <AddTile slot={slots[tiles - 1]} onPress={() => setChoosingSource(true)} />
            ) : null}
          </View>
        )}
      </FadingScroll>

      <Sheet
        visible={choosingSource}
        onClose={() => setChoosingSource(false)}
        onHidden={() => {
          if (!source) return;
          setSource(null);
          void pick(source);
        }}
        closeLabel={t("components.shared.nav.close")}
      >
        <Text accessibilityRole="header" className="mb-2 text-[22px] font-semibold leading-[1.27]">
          {t("screens.setup.photos.add")}
        </Text>
        <SheetRow
          icon={<IconPhoto size={22} color={colors.ink} strokeWidth={1.75} />}
          label={t("screens.setup.photos.library")}
          onPress={() => choose("library")}
        />
        <SheetRow
          icon={<IconCamera size={22} color={colors.ink} strokeWidth={1.75} />}
          label={t("screens.setup.photos.camera")}
          onPress={() => choose("camera")}
          last
        />
      </Sheet>

      {chosen ? (
        <PhotoViewer
          photo={chosen}
          number={ready.findIndex((photo) => photo.id === chosen.id) + 1}
          isCover={ready[0]?.id === chosen.id}
          visible={actionsOpen}
          onClose={() => setActionsOpen(false)}
          onHidden={() => setChosen(null)}
          onRemove={() => void remove(chosen)}
          onCover={() => makeCover(chosen)}
        />
      ) : null}
    </Screen>
  );
}

// A tapped photo, full screen on black (user, 2026-11-27): its number at the top end, the picture
// across the width at its own shape, cropped to at most 75% of the screen's height, and close,
// Remove and Set as cover along the bottom. The cover has nothing to set, so Remove takes the room.
function PhotoViewer({
  photo,
  number,
  isCover,
  visible,
  onClose,
  onHidden,
  onRemove,
  onCover,
}: {
  photo: Photo;
  number: number;
  isCover: boolean;
  visible: boolean;
  onClose: () => void;
  onHidden: () => void;
  onRemove: () => void;
  onCover: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const [aspect, setAspect] = useState(4 / 3);
  const height = Math.min(screen.width / aspect, screen.height * 0.75);
  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
      // iOS says when the fade has finished. Android has no onDismiss: the last photo stays mounted,
      // hidden, until the next tap replaces it.
      onDismiss={onHidden}
    >
      <StatusBar style="light" />
      <View
        className="flex-1 bg-black"
        style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-row items-center justify-end gap-2 px-5">
          {isCover ? (
            <View className="rounded-full bg-white/15 px-3 py-1">
              <Text className="text-label font-semibold text-white">
                {t("screens.setup.photos.cover")}
              </Text>
            </View>
          ) : null}
          <Text accessibilityRole="header" className="text-subtitle font-semibold text-white">
            {t("screens.setup.photos.photoNumber", { number })}
          </Text>
        </View>
        <View className="flex-1 justify-center">
          <Image
            source={{ uri: reachable(photo.url) }}
            contentFit="cover"
            onLoad={({ source }) => {
              if (source.width > 0 && source.height > 0) setAspect(source.width / source.height);
            }}
            style={{ width: screen.width, height }}
          />
        </View>
        <View className="flex-row items-center gap-3 px-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("components.shared.nav.close")}
            onPress={onClose}
            hitSlop={8}
            className="size-12 items-center justify-center rounded-full bg-white/15 active:opacity-70"
          >
            <IconX size={22} color={colors.white} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            {/* Destructive without red (the staff app has none): quiet, with a bin. */}
            <Button
              label={t("screens.setup.photos.removeShort")}
              compact
              variant="inverseSecondary"
              icon={<IconTrash size={17} color={colors.white} strokeWidth={2} />}
              onPress={onRemove}
            />
          </View>
          {isCover ? null : (
            <View className="flex-1">
              <Button label={t("screens.setup.photos.setCover")} compact onPress={onCover} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3.5 py-4 active:opacity-60 ${last ? "" : "border-b border-border"}`}
    >
      {icon}
      <Text className="text-subtitle font-medium">{label}</Text>
    </Pressable>
  );
}

// Tiles glide to new places by transform. Only a move into or out of the cover changes a tile's
// size, so only then does a glide cost a layout pass per frame.
const GLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };

// Uploads and the add tile follow the grid's slots from React: they're never dragged, and they only
// move when a photo is added or removed. Keyed on the numbers, since the grid rebuilds its slot
// objects on every render.
const useSlotStyle = (slot: Slot | undefined) => {
  const sx = slot?.x ?? 0;
  const sy = slot?.y ?? 0;
  const sw = slot?.width ?? 0;
  const sh = slot?.height ?? 0;
  const x = useSharedValue(sx);
  const y = useSharedValue(sy);
  const width = useSharedValue(sw);
  const height = useSharedValue(sh);
  useEffect(() => {
    x.value = withTiming(sx, GLIDE);
    y.value = withTiming(sy, GLIDE);
    width.value = withTiming(sw, GLIDE);
    height.value = withTiming(sh, GLIDE);
  }, [sx, sy, sw, sh, x, y, width, height]);
  return useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: width.value,
    height: height.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
};

// A picture of this shape just big enough to fill the cover, the largest place it can take.
const pictureFor = (aspect: number, gridWidth: number) => {
  "worklet";
  const cover = slotAt(0, gridWidth);
  return aspect > cover.width / cover.height
    ? { width: cover.height * aspect, height: cover.height }
    : { width: cover.width, height: cover.width / aspect };
};

// Moves `id` to `to`, the rest keeping their order around it.
const moved = (ids: string[], id: string, to: number) => {
  "worklet";
  const rest = ids.filter((other) => other !== id);
  rest.splice(to, 0, id);
  return rest;
};

// The faint grey place the carried photo will land in: it opens where the photo was lifted from
// and follows the finger as the others make room, then hides under the photo once it's down.
function DropGap({
  order,
  carried,
  gridWidth,
}: {
  order: SharedValue<string[]>;
  carried: SharedValue<string | null>;
  gridWidth: SharedValue<number>;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const shown = useSharedValue(0);

  useAnimatedReaction(
    () => (carried.value === null ? -1 : order.value.indexOf(carried.value)),
    (at, before) => {
      if (at === -1) {
        // Dropped: the photo glides onto the gap, which goes once it's covered.
        if (before !== null && before !== -1) {
          shown.value = withDelay(GLIDE.duration, withTiming(0, { duration: 0 }));
        }
        return;
      }
      const slot = slotAt(at, gridWidth.value);
      if (before === null || before === -1) {
        // Lifted: the gap opens where the photo was, under it.
        x.value = slot.x;
        y.value = slot.y;
        width.value = slot.width;
        height.value = slot.height;
        shown.value = withTiming(1, { duration: 120 });
        return;
      }
      x.value = withTiming(slot.x, GLIDE);
      y.value = withTiming(slot.y, GLIDE);
      width.value = withTiming(slot.width, GLIDE);
      height.value = withTiming(slot.height, GLIDE);
    },
  );

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: width.value,
    height: height.value,
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { borderRadius: 8, backgroundColor: colors.field }]}
    />
  );
}

function PhotoTile({
  photo,
  index,
  width: initialWidth,
  order,
  carried,
  gridWidth,
  onDragStart,
  onDrop,
  onPress,
}: {
  photo: Photo;
  index: number;
  width: number;
  order: SharedValue<string[]>;
  carried: SharedValue<string | null>;
  gridWidth: SharedValue<number>;
  onDragStart: () => void;
  onDrop: (ids: string[]) => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const id = photo.id;
  const start = slotAt(index, initialWidth);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const width = useSharedValue(start.width);
  const height = useSharedValue(start.height);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const lifted = useSharedValue(0);
  // Above the others from the lift until it has landed, so it never passes under the photos it
  // glides over on the way to its place.
  const onTop = useSharedValue(0);
  // The picture's own width over height, known once it has loaded.
  const aspect = useSharedValue(4 / 3);

  // To its place whenever the order on screen moves it, during a drag included. The carried photo
  // follows the finger instead, and is sent to its place when it's let go.
  useAnimatedReaction(
    () => ({ at: order.value.indexOf(id), width: gridWidth.value }),
    (now, before) => {
      if (now.at === -1 || carried.value === id) return;
      if (before && now.at === before.at && now.width === before.width) return;
      const slot = slotAt(now.at, now.width);
      x.value = withTiming(slot.x, GLIDE);
      y.value = withTiming(slot.y, GLIDE);
      width.value = withTiming(slot.width, GLIDE);
      height.value = withTiming(slot.height, GLIDE);
    },
  );

  const lift = () => {
    onDragStart();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart((event) => {
      touchX.value = event.x;
      touchY.value = event.y;
      carried.value = id;
      onTop.value = 1;
      lifted.value = withTiming(1, { duration: 120 });
      runOnJS(lift)();
    })
    .onUpdate((event) => {
      dx.value = event.translationX;
      dy.value = event.translationY;
      // Where the finger is, in the grid's coordinates; the others make room as it moves.
      const ids = order.value;
      const to = placeAt(
        x.value + touchX.value + event.translationX,
        y.value + touchY.value + event.translationY,
        ids.length,
        gridWidth.value,
      );
      if (to !== ids.indexOf(id)) order.value = moved(ids, id, to);
    })
    .onEnd(() => {
      // The drag becomes the tile's position, so it carries on from where it was let go into the
      // place that's been kept open for it.
      x.value = x.value + dx.value;
      y.value = y.value + dy.value;
      dx.value = 0;
      dy.value = 0;
      const slot = slotAt(order.value.indexOf(id), gridWidth.value);
      x.value = withTiming(slot.x, GLIDE);
      y.value = withTiming(slot.y, GLIDE, () => {
        onTop.value = 0;
      });
      width.value = withTiming(slot.width, GLIDE);
      height.value = withTiming(slot.height, GLIDE);
      lifted.value = withTiming(0, GLIDE);
      carried.value = null;
      runOnJS(onDrop)(order.value.slice());
    })
    .onFinalize(() => {
      // A drag that never got going (or was cancelled) just settles back.
      dx.value = withTiming(0, GLIDE);
      dy.value = withTiming(0, GLIDE);
      lifted.value = withTiming(0, GLIDE);
    });
  const tap = Gesture.Tap().onEnd(() => runOnJS(onPress)());

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: width.value,
    height: height.value,
    zIndex: onTop.value ? 10 : 1,
    transform: [
      { translateX: x.value + dx.value },
      { translateY: y.value + dy.value },
      { scale: 1 + (LIFT - 1) * lifted.value },
    ],
    shadowOpacity: 0.18 * lifted.value,
  }));
  // The chip follows the order on screen, so it moves with the cover during a drag.
  const chip = useAnimatedStyle(() => ({
    opacity: withTiming(order.value[0] === id ? 1 : 0, { duration: 150 }),
  }));
  // The picture is laid out once, at its own shape and big enough to fill the cover, and scaled
  // to fill the tile: expo-image reloads (and downscales again) whenever its view changes size, so
  // a picture sized with the tile would reload on every frame of a glide into or out of the cover.
  // Scaling a picture of its own shape to cover the tile is what contentFit "cover" does, so it
  // looks the same at rest as it did, and grows without a jump.
  const pictureSize = useAnimatedStyle(() => {
    const size = pictureFor(aspect.value, gridWidth.value);
    return { position: "absolute", left: 0, top: 0, width: size.width, height: size.height };
  });
  const pictureFit = useAnimatedStyle(() => {
    const size = pictureFor(aspect.value, gridWidth.value);
    return {
      transform: [
        { translateX: (width.value - size.width) / 2 },
        { translateY: (height.value - size.height) / 2 },
        { scale: Math.max(width.value / size.width, height.value / size.height) },
      ],
    };
  });

  return (
    <GestureDetector gesture={Gesture.Race(drag, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={index === 0 ? t("screens.setup.photos.cover") : undefined}
        style={[
          style,
          {
            // Opaque and rounded, so iOS draws the lifted shadow from the shape instead of
            // working it out from the picture's pixels on every frame.
            borderRadius: 8,
            backgroundColor: colors.border,
            shadowColor: colors.ink,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
          },
        ]}
      >
        {/* Clipped here rather than on the tile, which would clip its shadow too. */}
        <View style={{ flex: 1, borderRadius: 8, overflow: "hidden" }}>
          <Animated.View style={[pictureSize, pictureFit]}>
            <Image
              source={{ uri: reachable(photo.url) }}
              contentFit="cover"
              transition={150}
              onLoad={(event) => {
                const { width: w, height: h } = event.source;
                if (w > 0 && h > 0) aspect.value = w / h;
              }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={chip}
          className="absolute start-2.5 top-2.5 rounded-[6px] bg-white px-2 py-1"
        >
          <Text className="text-caption font-medium">{t("screens.setup.photos.cover")}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// A photo on its way up: the picked image, dimmed, with how much has gone.
function UploadTile({ upload, slot }: { upload: Upload; slot: Slot | undefined }) {
  const place = useSlotStyle(slot);

  return (
    <Animated.View style={place}>
      <Image
        source={{ uri: upload.uri }}
        contentFit="cover"
        style={{ flex: 1, borderRadius: 8, backgroundColor: colors.border }}
      />
      <View className="absolute inset-0 items-center justify-center rounded-[8px] bg-ink/40">
        <Text className="text-label font-semibold text-white">
          {`${Math.round(upload.progress * 100)}%`}
        </Text>
      </View>
    </Animated.View>
  );
}

function AddTile({ slot, onPress }: { slot: Slot | undefined; onPress: () => void }) {
  const { t } = useTranslation();
  const place = useSlotStyle(slot);

  return (
    <Animated.View style={place}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-1 items-center justify-center rounded-[8px] border border-dashed border-ink-3 bg-field active:opacity-70"
      >
        <IconPlus size={22} color={colors.ink} strokeWidth={1.75} />
        <Text className="mt-1.5 text-body font-medium">{t("screens.setup.photos.addMore")}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default guarded(RULES.venueForm, SetupPhotos);
