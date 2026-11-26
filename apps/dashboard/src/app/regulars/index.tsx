import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { Empty } from "@/components/empty";
import { NoWeeklyArt } from "@/components/empty-art";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconGripVertical, IconPlus } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { hourLabel } from "@/lib/hours";
import { intlLocale, isRTL } from "@/lib/language";
import { overlaps, regularsQuery, weeksDecided, type Regular } from "@/lib/regulars";
import { push } from "@/lib/navigation";

// The venue's regulars (Figma D12 653:3), from the Venue tab: their weekly games under the weekday,
// Sundays first, each with its hours, who, the ground and how the weeks have gone. Regulars who
// want the same hours on a ground share one time, in priority order: "1st", then "2nd in line" (the
// one who gets a week the first lets go). Paused ones are greyed with the day they paused; ended ones
// are left out. + sets up a new weekly game (bookings: manage).
//
// Reordering (Figma 653:67, bookings: manage): in a time two or more regulars share, holding a row
// lifts it as a card with a grip over a dashed gap where it would land; dragging moves the others
// out of the way, each saying its new place ("now 2nd"). A bar then says the new order with Save
// order. Only weeks reserved from then on follow it.

const FALLBACK_TIMEZONE = "Africa/Cairo";

// 0–6 from Sunday, as the API counts weekdays.
type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

// Regulars that want the same hours, shown under one time; most stand alone.
type Group = Regular[];

// How long a row is held before it lifts (the hours grid's and Select day's beat).
const HOLD_MS = 250;
// The others sliding out of the way, and the card settling into its gap.
const SLIDE_MS = 180;
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function Regulars() {
  const { t } = useTranslation();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const canAdd = venue?.permissions.bookings === "manage";
  const compact = useCompactTitle();
  const regulars = useQuery(regularsQuery(venueId));
  const settings = useQuery(bookingSettingsQuery(venueId)).data;
  const hud = useHud();
  const queryClient = useQueryClient();
  // A shared time being reordered: its regulars in the new order, by the first one's id as saved.
  const [pending, setPending] = useState<{ key: string; ids: string[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const days = byDay(regulars.data ?? []);
  const title = t("screens.regulars.title");
  // The pending order's time, as saved, while it's still there and still the same regulars.
  const pendingGroup = (() => {
    if (!pending) return undefined;
    const group = days.flatMap((day) => day.groups).find((one) => one[0]?.id === pending.key);
    if (!group || group.length !== pending.ids.length) return undefined;
    return pending.ids.every((id) => group.some((regular) => regular.id === id))
      ? group
      : undefined;
  })();
  const changed =
    pendingGroup !== undefined &&
    pending !== null &&
    pending.ids.some((id, index) => pendingGroup[index]?.id !== id);
  const ordered = (group: Group) =>
    pending && pendingGroup === group
      ? pending.ids.map((id) => group.find((regular) => regular.id === id) as Regular)
      : group;

  const save = async () => {
    if (!pending) return;
    setSaving(true);
    const result = await send(
      api.PUT("/v1/staff/venues/{venueId}/regulars/order", {
        params: { path: { venueId } },
        body: { regularIds: pending.ids },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    queryClient.setQueryData(regularsQuery(venueId).queryKey, result.data.data);
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "regulars"] });
    setPending(null);
  };

  return (
    <Screen
      footer={
        changed && pending ? (
          <BottomBar
            title={pending.ids
              .map((id, index) =>
                t("screens.regulars.reorder.who", {
                  name: firstName(
                    pendingGroup?.find((regular) => regular.id === id)?.customer.name ?? "",
                  ),
                  place: t("screens.regulars.reorder.place", { count: index + 1, ordinal: true }),
                }),
              )
              .join(t("screens.regulars.new.comma"))}
            detail={t("screens.regulars.reorder.stay")}
          >
            <BarButton
              label={t("screens.regulars.reorder.save")}
              primary
              busy={saving}
              onPress={() => void save()}
            />
          </BottomBar>
        ) : undefined
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
        end={
          canAdd ? (
            <RoundButton
              icon={IconPlus}
              label={t("screens.regulars.add")}
              onPress={() => push("/regulars/new")}
            />
          ) : undefined
        }
      />
      <FadingScroll scrollY={compact.scrollY} scrollEnabled={!dragging}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={
            settings
              ? `${t("screens.regulars.horizon", { count: settings.regularHorizon })} ${deadlineLine(t, settings.confirmationWindow)}`
              : undefined
          }
        >
          {title}
        </Title>
        {regulars.isPending ? (
          <ActivityIndicator className="my-10" color={colors.ink3} />
        ) : regulars.isError ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.regulars.failed")}</Text>
        ) : days.length === 0 ? (
          <Empty
            art={<NoWeeklyArt scale={0.8} />}
            title={t("screens.regulars.noneTitle")}
            body={t("screens.regulars.none")}
            action={
              canAdd
                ? { label: t("screens.regulars.add"), onPress: () => push("/regulars/new") }
                : undefined
            }
          />
        ) : (
          days.map(({ day, groups }, index) => (
            <View key={day} className={index === 0 ? "mt-2" : "mt-6"}>
              <GroupHeading>{t(`screens.regulars.days.${String(day) as Weekday}`)}</GroupHeading>
              {groups.map((group) => (
                <TimeGroup
                  key={group[0]?.id}
                  group={ordered(group)}
                  saved={group}
                  canReorder={canAdd && group.length > 1}
                  onOrder={(ids) => {
                    const key = group[0]?.id;
                    if (key) setPending({ key, ids });
                  }}
                  onDragging={setDragging}
                  onOpen={(id) => push(`/regulars/${id}`)}
                />
              ))}
            </View>
          ))
        )}
      </FadingScroll>
    </Screen>
  );
}

// The weekdays that have regulars, Sunday first, each with its times. The list comes by weekday,
// hour, then priority, so regulars that overlap the ones before them join that time.
const byDay = (regulars: readonly Regular[]) => {
  const days: { day: number; groups: Group[] }[] = [];
  for (const regular of regulars) {
    if (regular.status === "ENDED") continue;
    let day = days.at(-1);
    if (!day || day.day !== regular.dayOfWeek) {
      day = { day: regular.dayOfWeek, groups: [] };
      days.push(day);
    }
    const shared = day.groups.find((group) => group.some((other) => overlaps(other, regular)));
    if (shared) shared.push(regular);
    else day.groups.push([regular]);
  }
  return days;
};

// "Each week waits for a confirm by the day before.", or so many days or hours before.
const deadlineLine = (t: TFunction, hours: number) =>
  hours === 24
    ? t("screens.regulars.confirmDay")
    : hours % 24 === 0
      ? t("screens.regulars.confirmDays", { count: hours / 24 })
      : t("screens.regulars.confirmHours", { count: hours });

// One time on the weekday: its hours once on the left, the regulars wanting it on the right, a
// hairline under each (indented between regulars sharing the time). Shared by two or more, a row
// held lifts to be dragged into another place.
function TimeGroup({
  group,
  saved,
  canReorder,
  onOrder,
  onDragging,
  onOpen,
}: {
  // In the order shown (a pending reorder), and as saved.
  group: Group;
  saved: Group;
  canReorder: boolean;
  onOrder: (ids: string[]) => void;
  onDragging: (dragging: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<string | null>(null);
  const rowHeight = useRef(72);
  // The order when the drag began, and where the dragged one started in it.
  const start = useRef<{ ids: string[]; index: number; at: number }>({ ids: [], index: 0, at: 0 });
  // The card's offset from the gap it would land in.
  const lift = useSharedValue(0);
  const card = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  const first = group[0];
  if (!first) return null;
  // The time is greyed when nobody in it is playing for now.
  const paused = group.every((regular) => regular.status === "PAUSED");

  const dragFor = (id: string) =>
    Gesture.Pan()
      .runOnJS(true)
      .enabled(canReorder)
      .activateAfterLongPress(HOLD_MS)
      .onStart(() => {
        const ids = group.map((regular) => regular.id);
        const index = ids.indexOf(id);
        start.current = { ids, index, at: index };
        lift.value = 0;
        setDragId(id);
        onDragging(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((event) => {
        const { ids, index, at } = start.current;
        const to = Math.min(
          Math.max(Math.round(index + event.translationY / rowHeight.current), 0),
          ids.length - 1,
        );
        if (to !== at) {
          const next = ids.filter((one) => one !== id);
          next.splice(to, 0, id);
          start.current.at = to;
          onOrder(next);
          void Haptics.selectionAsync();
        }
        lift.value = event.translationY - (to - index) * rowHeight.current;
      })
      .onFinalize(() => {
        lift.value = withTiming(0, { duration: SLIDE_MS });
        setTimeout(() => setDragId(null), SLIDE_MS);
        onDragging(false);
      });

  return (
    <View className="flex-row border-b border-border">
      <View className="w-[60px] pt-3.5">
        <Text className={`text-[15px] leading-[20px] ${paused ? "text-ink-3" : "font-semibold"}`}>
          {hourLabel(t, first.startHour)}
        </Text>
        <Text className="text-[13px] leading-[17px] text-ink-3">
          {hourLabel(t, first.startHour + first.slotCount)}
        </Text>
      </View>
      <View className="flex-1">
        {group.map((regular, index) => {
          const was = saved.findIndex((one) => one.id === regular.id);
          const place = group.length > 1 ? index + 1 : null;
          const lifted = regular.id === dragId;
          return (
            <Animated.View
              key={regular.id}
              layout={lifted ? undefined : LinearTransition.duration(SLIDE_MS)}
              style={{ zIndex: lifted ? 1 : 0 }}
            >
              <GestureDetector gesture={dragFor(regular.id)}>
                <View collapsable={false}>
                  {lifted ? (
                    // The gap it would land in, dashed, with the card over it.
                    <View
                      className="rounded-[12px] border-[1.5px] border-dashed border-primary"
                      style={{ height: rowHeight.current }}
                    >
                      <Animated.View
                        className="absolute top-0 bottom-0 flex-row items-center rounded-[16px] bg-white px-4"
                        style={[
                          card,
                          {
                            left: -48,
                            right: 0,
                            shadowColor: "#000",
                            shadowOpacity: 0.14,
                            shadowRadius: 18,
                            shadowOffset: { width: 0, height: 8 },
                            elevation: 8,
                          },
                        ]}
                      >
                        <View className="w-[56px]">
                          <Text className="text-[15px] leading-[20px] font-semibold">
                            {hourLabel(t, regular.startHour)}
                          </Text>
                          <Text className="text-[13px] leading-[17px] text-ink-3">
                            {hourLabel(t, regular.startHour + regular.slotCount)}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-[16px] leading-[21px] font-medium"
                            numberOfLines={1}
                          >
                            {regular.customer.name}
                          </Text>
                          <Text className="text-[14px] leading-[19px] text-ink-2">
                            {[
                              regular.ground.name,
                              t("screens.regulars.reorder.place", {
                                count: index + 1,
                                ordinal: true,
                              }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        <IconGripVertical size={18} color={colors.ink3} strokeWidth={2} />
                      </Animated.View>
                    </View>
                  ) : (
                    <Row
                      regular={regular}
                      place={place}
                      moved={was !== index}
                      divider={index < group.length - 1}
                      onPress={() => onOpen(regular.id)}
                      onLayout={(event) => {
                        rowHeight.current = event.nativeEvent.layout.height;
                      }}
                    />
                  )}
                </View>
              </GestureDetector>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function Row({
  regular,
  place,
  moved,
  divider,
  onPress,
  onLayout,
}: {
  regular: Regular;
  place: number | null;
  // A reorder not yet saved puts it somewhere new: "now 2nd".
  moved: boolean;
  divider: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  const paused = regular.status === "PAUSED";
  const weeks = weeksDecided(regular);
  const line = [
    regular.ground.name,
    place === null
      ? null
      : moved
        ? t("screens.regulars.reorder.now", {
            place: t("screens.regulars.reorder.place", { count: place, ordinal: true }),
          })
        : place === 1
          ? t("screens.regulars.first")
          : t("screens.regulars.inLine", { count: place, ordinal: true }),
    paused && regular.pausedAt
      ? t("screens.regulars.paused", { date: dateLabel(regular.pausedAt) })
      : weeks > 0
        ? t("screens.regulars.confirmed", {
            confirmed: regular.reliability.confirmed,
            count: weeks,
          })
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLayout={onLayout}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-60 ${divider ? "border-b border-border" : ""}`}
    >
      <View className="flex-1">
        <Text
          className={`text-[16px] font-medium leading-[21px] ${paused ? "text-ink-2" : ""}`}
          numberOfLines={1}
        >
          {regular.customer.name}
        </Text>
        <Text className="mt-0.5 text-[14px] leading-[19px] text-ink-2">{line}</Text>
      </View>
      <IconChevronRight
        size={20}
        color={colors.unit}
        strokeWidth={2}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </Pressable>
  );
}

// "12 Nov", in the venue's time (Egypt for now), with the year when it isn't this one.
const dateLabel = (at: string) => {
  const date = new Date(at);
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: FALLBACK_TIMEZONE,
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
};
