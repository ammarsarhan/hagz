import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { components } from "@hagz/api";
import { MAXIMUM_VENUE_PHOTOS, MINIMUM_VENUE_PHOTOS } from "@hagz/contracts";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import { IconCamera, IconPhoto, IconPhotoPlus, IconPlus, IconTrash } from "@/components/icons";
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
import { queries } from "@/lib/queries";

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

// Where the nth tile goes: the first across the top, the rest two to a row under it.
const layoutFor = (count: number, width: number) => {
  const coverHeight = Math.round(width * COVER_RATIO);
  const tileWidth = (width - GAP) / 2;
  const tileHeight = Math.round(tileWidth * TILE_RATIO);
  const slots: Slot[] = Array.from({ length: count }, (_, index) => {
    if (index === 0) return { x: 0, y: 0, width, height: coverHeight };
    const column = (index - 1) % 2;
    const row = Math.floor((index - 1) / 2);
    return {
      x: column * (tileWidth + GAP),
      y: coverHeight + GAP + row * (tileHeight + GAP),
      width: tileWidth,
      height: tileHeight,
    };
  });
  const rows = Math.ceil(Math.max(count - 1, 0) / 2);
  const height = count === 0 ? 0 : coverHeight + rows * (tileHeight + GAP);
  return { slots, height };
};

export default function SetupPhotos() {
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

  const photosKey = queries.photos(venueId).queryKey;
  // The checklist and the draft card count photos too.
  const refresh = () => queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });

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
        }),
      );
      if (!confirmed.ok) throw confirmed.error;
      // Into the grid before the tile goes, so it doesn't blink out and back.
      await refresh();
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
    void refresh();
  };

  // A photo dropped at a point in the grid takes the place of the ready photo it landed on, or the
  // nearest one; uploads and the add tile aren't places to drop.
  const drop = (from: number, x: number, y: number) => {
    setDragging(false);
    const places = slots.slice(0, ready.length);
    const centre = (slot: Slot) => ({ x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 });
    const inside = places.findIndex(
      (slot) => x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height,
    );
    const to =
      inside !== -1
        ? inside
        : places.reduce((best, slot, index) => {
            const a = centre(slot);
            const b = centre(places[best] ?? slot);
            return Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? index : best;
          }, 0);
    if (to === from) return;
    const ids = ready.map((photo) => photo.id);
    const [moved] = ids.splice(from, 1);
    if (moved) ids.splice(to, 0, moved);
    void reorder(ids);
  };

  const remove = async (photo: Photo) => {
    setActionsOpen(false);
    const result = await send(
      api.DELETE("/v1/staff/venues/{venueId}/photos/{photoId}", {
        params: { path: { venueId, photoId: photo.id } },
      }),
    );
    if (!result.ok) return hud.show(hudMessage(result.error));
    void refresh();
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
            {ready.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                index={index}
                slot={slots[index]}
                cover={index === 0}
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
        <Sheet
          visible={actionsOpen}
          onClose={() => setActionsOpen(false)}
          onHidden={() => setChosen(null)}
          closeLabel={t("components.shared.nav.close")}
        >
          {/* Which photo this is, in the order players see them: also the gap between the close
              button and the picture. */}
          <Text
            accessibilityRole="header"
            className="mb-4 mt-1 text-[22px] font-semibold leading-[1.27]"
          >
            {t("screens.setup.photos.photoNumber", {
              number: ready.findIndex((photo) => photo.id === chosen.id) + 1,
            })}
          </Text>
          <Image
            source={{ uri: reachable(chosen.url) }}
            contentFit="cover"
            style={{ height: 180, borderRadius: 8, marginBottom: 16 }}
          />
          <View className="gap-1">
            {ready[0]?.id !== chosen.id ? (
              <Button
                label={t("screens.setup.photos.makeCover")}
                variant="secondary"
                onPress={() => makeCover(chosen)}
              />
            ) : null}
            {/* Destructive, without red (the staff app has none): a bin and a heavier weight, still
                a line of text under the main action rather than a second button. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("screens.setup.photos.remove")}
              onPress={() => void remove(chosen)}
              hitSlop={8}
              className="h-12 flex-row items-center justify-center gap-1.5 active:opacity-60"
            >
              <IconTrash size={18} color={colors.ink} strokeWidth={2} />
              <Text className="text-body font-semibold">{t("screens.setup.photos.remove")}</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </Screen>
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

// A tile glides to its new place when the order changes. It moves by transform (no layout pass per
// frame), and the glide restarts only when its place really changes: keyed on the numbers, since
// the grid rebuilds its slot objects on every render, and a drop causes several renders in a row.
const GLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };

const useSlotStyle = (slot: Slot | undefined) => {
  const sx = slot?.x ?? 0;
  const sy = slot?.y ?? 0;
  const sw = slot?.width ?? 0;
  const sh = slot?.height ?? 0;
  const x = useSharedValue(sx);
  const y = useSharedValue(sy);
  const width = useSharedValue(sw);
  const height = useSharedValue(sh);
  // Where it's headed: a dropped tile heads back here when the order didn't change.
  const targetX = useSharedValue(sx);
  const targetY = useSharedValue(sy);
  useEffect(() => {
    targetX.value = sx;
    targetY.value = sy;
    x.value = withTiming(sx, GLIDE);
    y.value = withTiming(sy, GLIDE);
    width.value = withTiming(sw, GLIDE);
    height.value = withTiming(sh, GLIDE);
  }, [sx, sy, sw, sh, x, y, width, height, targetX, targetY]);
  const box = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: width.value,
    height: height.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  return { x, y, width, height, targetX, targetY, box };
};

function PhotoTile({
  photo,
  index,
  slot,
  cover,
  onDragStart,
  onDrop,
  onPress,
}: {
  photo: Photo;
  index: number;
  slot: Slot | undefined;
  cover: boolean;
  onDragStart: () => void;
  onDrop: (from: number, x: number, y: number) => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const place = useSlotStyle(slot);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const lifted = useSharedValue(0);

  const lift = () => {
    onDragStart();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart((event) => {
      touchX.value = event.x;
      touchY.value = event.y;
      lifted.value = withTiming(1, { duration: 120 });
      runOnJS(lift)();
    })
    .onUpdate((event) => {
      dx.value = event.translationX;
      dy.value = event.translationY;
    })
    .onEnd((event) => {
      // Where the finger is, in the grid's coordinates.
      runOnJS(onDrop)(
        index,
        place.x.value + touchX.value + event.translationX,
        place.y.value + touchY.value + event.translationY,
      );
      // The drag becomes the tile's position, so it carries on from where it was let go instead
      // of springing back first: home if the order stays, or (a frame later, once the new order
      // arrives) on to its new place.
      place.x.value = place.x.value + dx.value;
      place.y.value = place.y.value + dy.value;
      dx.value = 0;
      dy.value = 0;
      place.x.value = withTiming(place.targetX.value, GLIDE);
      place.y.value = withTiming(place.targetY.value, GLIDE);
    })
    .onFinalize(() => {
      // A drag that never got going (or was cancelled) just settles back.
      dx.value = withTiming(0, GLIDE);
      dy.value = withTiming(0, GLIDE);
      lifted.value = withTiming(0, { duration: 180 });
    });
  const tap = Gesture.Tap().onEnd(() => runOnJS(onPress)());

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: place.width.value,
    height: place.height.value,
    zIndex: lifted.value > 0 ? 10 : 1,
    transform: [
      { translateX: place.x.value + dx.value },
      { translateY: place.y.value + dy.value },
      { scale: 1 + (LIFT - 1) * lifted.value },
    ],
    shadowOpacity: 0.18 * lifted.value,
  }));

  return (
    <GestureDetector gesture={Gesture.Race(drag, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={cover ? t("screens.setup.photos.cover") : undefined}
        style={[
          style,
          { shadowColor: "#0b0b0c", shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
        ]}
      >
        <Image
          source={{ uri: reachable(photo.url) }}
          contentFit="cover"
          transition={150}
          style={{ flex: 1, borderRadius: 8, backgroundColor: colors.border }}
        />
        {cover ? (
          <View className="absolute start-2.5 top-2.5 rounded-[6px] bg-white px-2 py-1">
            <Text className="text-caption font-medium">{t("screens.setup.photos.cover")}</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

// A photo on its way up: the picked image, dimmed, with how much has gone.
function UploadTile({ upload, slot }: { upload: Upload; slot: Slot | undefined }) {
  const place = useSlotStyle(slot);

  return (
    <Animated.View style={place.box}>
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
    <Animated.View style={place.box}>
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
