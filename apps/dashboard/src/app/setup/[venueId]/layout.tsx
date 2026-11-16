import type { components } from "@hagz/api";
import type { VenueLayoutView } from "@hagz/contracts";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmenityIcon } from "@/components/amenity-icon";
import { useHud } from "@/components/hud";
import {
  IconChevronLeft,
  IconDoor,
  IconEye,
  IconList,
  IconMinus,
  IconPlus,
} from "@/components/icons";
import {
  fitCamera,
  LayoutCanvas,
  PitchArt,
  useCamera,
  zoomAround,
} from "@/components/layout-canvas";
import { SetupLoading } from "@/components/setup-loading";
import { Text } from "@/components/text";
import { FloatingButton, floatShadow } from "@/components/venue-map";
import { colors } from "@/lib/colors";
import type { Ground } from "@/lib/grounds";
import { queries, reference } from "@/lib/queries";

type Amenity = components["schemas"]["Amenity"];

// Setup item "Layout" (Figma "Layout", 376:2–378:2): the venue drawn to scale, full screen, with the
// grounds and amenities on it and what's still to place in a tray at the bottom. This first cut
// shows the saved layout (or the empty grid a new one starts as) and moves around it; placing,
// moving and sizing things come next.

// The tray: its padding, title and one row of 64-high chips.
const TRAY_HEIGHT = 132;

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
  return <LayoutView layout={layout.data} grounds={grounds.data} options={options.data} />;
}

function LayoutView({
  layout,
  grounds,
  options,
}: {
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

  const groundsById = useMemo(() => new Map(grounds.map((g) => [g.id, g])), [grounds]);
  const amenitiesById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const unplaced = layout.unplacedGroundIds.flatMap((id) => groundsById.get(id) ?? []);
  // The venue's amenities that can go on the layout. They stay in the tray once placed: a venue
  // can have two car parks.
  const placeable = layout.placeableOptionIds.flatMap((id) => amenitiesById.get(id) ?? []);
  const total = layout.grounds.length + layout.unplacedGroundIds.length;

  const comingNext = () => hud.show(t("common.comingNext"));
  const middle = { x: screen.width / 2, y: (area.top + screen.height - area.bottom) / 2 };

  return (
    <View className="flex-1 bg-field">
      <StatusBar style="dark" />
      <LayoutCanvas
        layout={layout}
        grounds={groundsById}
        amenities={amenitiesById}
        camera={camera}
        screen={screen}
      />

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
            {t("screens.setup.layout.placed", { placed: layout.grounds.length, count: total })}
          </Text>
        </View>
        <FloatingButton label={t("screens.setup.layout.preview")} onPress={comingNext}>
          <IconEye size={24} color={colors.ink} strokeWidth={1.75} />
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
        <FloatingButton label={t("screens.setup.layout.list")} onPress={comingNext}>
          <IconList size={24} color={colors.ink} strokeWidth={1.75} />
        </FloatingButton>
      </View>

      {/* What's still to place: grounds not on the layout, the venue's amenities, entrances. */}
      <View
        className="absolute inset-x-3 rounded-[24px] bg-white py-[18px] pl-[18px]"
        style={{
          bottom: insets.bottom,
          height: TRAY_HEIGHT,
          shadowColor: colors.ink,
          shadowOpacity: 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        <Text className="pb-3 text-[16px] font-medium">{t("screens.setup.layout.notPlaced")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 18 }}
        >
          {unplaced.map((ground) => (
            <GroundChip key={ground.id} ground={ground} />
          ))}
          {placeable.map((amenity) => (
            <Chip
              key={amenity.id}
              icon={<AmenityIcon name={amenity.icon} size={24} color={colors.ink} />}
              label={amenity.name}
            />
          ))}
          <Chip
            icon={<IconDoor size={24} color={colors.ink} strokeWidth={1.75} />}
            label={t("screens.setup.layout.entrance")}
          />
        </ScrollView>
      </View>
    </View>
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
    <View className="h-16 flex-row items-center gap-2.5 rounded-[16px] border border-border bg-white pl-3 pr-3.5">
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
    <View className="h-16 flex-row items-center gap-2.5 rounded-[16px] border border-border bg-white pl-3 pr-3.5">
      {icon}
      <Text className="text-[15px] font-medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
