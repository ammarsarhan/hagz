import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
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
                // "1) Hossam, 2) Youssef" (user, 2026-11-26).
                t("screens.regulars.reorder.who", {
                  name: firstName(
                    pendingGroup?.find((regular) => regular.id === id)?.customer.name ?? "",
                  ),
                  place: index + 1,
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
//
// As the photos grid does it (setup/[venueId]/photos.tsx): the rows are drawn in one fixed order
// that never changes, each glided to its place in `order` on the UI thread, so nothing is redrawn
// or remounted while a row is carried, and saving moves nothing (user, 2026-11-26: the first take,
// reordering the list itself as it went, jumped).
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
  const ids = group.map((regular) => regular.id);
  const key = ids.join(",");
  // The order on screen, moved by the drag before anything else hears of it.
  const order = useSharedValue(ids);
  const carried = useSharedValue<string | null>(null);
  const rowHeight = useSharedValue(0);
  // A new order from outside (saved, or the pending one dropped): taken up when nothing's carried.
  useEffect(() => {
    if (carried.value === null) order.value = key.split(",");
  }, [key, order, carried]);

  // The gap the carried row will land in.
  const gap = useAnimatedStyle(() => {
    const at = carried.value === null ? -1 : order.value.indexOf(carried.value);
    return {
      opacity: withTiming(at === -1 ? 0 : 1, { duration: 120 }),
      height: rowHeight.value,
      transform: [{ translateY: withTiming(Math.max(at, 0) * rowHeight.value, GLIDE) }],
    };
  });

  const first = group[0];
  if (!first) return null;
  // The time is greyed when nobody in it is playing for now.
  const paused = group.every((regular) => regular.status === "PAUSED");
  // Drawn in one order whatever the order shown: by id.
  const drawn = [...group].sort((a, b) => a.id.localeCompare(b.id));

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
        {group.length > 1 ? (
          <Animated.View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 rounded-[12px] border-[1.5px] border-dashed border-primary"
            style={gap}
          />
        ) : null}
        {drawn.map((regular, drawnAt) => {
          const index = ids.indexOf(regular.id);
          const was = saved.findIndex((one) => one.id === regular.id);
          return (
            <Slot
              key={regular.id}
              regular={regular}
              drawnAt={drawnAt}
              order={order}
              carried={carried}
              rowHeight={rowHeight}
              canReorder={canReorder}
              place={group.length > 1 ? index + 1 : null}
              moved={was !== index}
              divider={index < group.length - 1}
              onDragging={onDragging}
              onDrop={onOrder}
              onPress={() => onOpen(regular.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

// How a row glides into its place.
const GLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) };

const movedTo = (ids: string[], id: string, to: number) => {
  "worklet";
  const next = ids.filter((one) => one !== id);
  next.splice(to, 0, id);
  return next;
};

// One regular in a shared time: in the list's own flow at `drawnAt`, moved by `y` to its place in
// `order`; carried, it follows the finger as a lifted card with a grip.
function Slot({
  regular,
  drawnAt,
  order,
  carried,
  rowHeight,
  canReorder,
  place,
  moved,
  divider,
  onDragging,
  onDrop,
  onPress,
}: {
  regular: Regular;
  drawnAt: number;
  order: SharedValue<string[]>;
  carried: SharedValue<string | null>;
  rowHeight: SharedValue<number>;
  canReorder: boolean;
  place: number | null;
  moved: boolean;
  divider: boolean;
  onDragging: (dragging: boolean) => void;
  onDrop: (ids: string[]) => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const id = regular.id;
  const y = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);
  const onTop = useSharedValue(0);

  // To its place whenever the order on screen moves it; the carried one follows the finger.
  useAnimatedReaction(
    () => ({ at: order.value.indexOf(id), height: rowHeight.value }),
    (now, before) => {
      if (now.at === -1 || carried.value === id) return;
      const target = (now.at - drawnAt) * now.height;
      // The first time, and when the row's height is first known, straight there.
      if (!before || before.height !== now.height) y.value = target;
      else if (now.at !== before.at) y.value = withTiming(target, GLIDE);
    },
  );

  const lift = () => {
    onDragging(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  const tick = () => void Haptics.selectionAsync();
  const drop = (ids: string[]) => {
    onDragging(false);
    onDrop(ids);
  };

  const drag = Gesture.Pan()
    .enabled(canReorder)
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      carried.value = id;
      onTop.value = 1;
      lifted.value = withTiming(1, { duration: 120 });
      runOnJS(lift)();
    })
    .onUpdate((event) => {
      dy.value = event.translationY;
      const ids = order.value;
      const height = rowHeight.value || 1;
      // Where the card's middle is, in places.
      const middle = (y.value + dy.value) / height + drawnAt;
      const to = Math.min(Math.max(Math.round(middle), 0), ids.length - 1);
      if (to !== ids.indexOf(id)) {
        order.value = movedTo(ids, id, to);
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      // The drag becomes its position, then it glides into the place kept open for it.
      y.value = y.value + dy.value;
      dy.value = 0;
      y.value = withTiming((order.value.indexOf(id) - drawnAt) * rowHeight.value, GLIDE, () => {
        onTop.value = 0;
      });
      lifted.value = withTiming(0, GLIDE);
      carried.value = null;
      runOnJS(drop)(order.value.slice());
    })
    .onFinalize(() => {
      // A drag that never got going (or was cancelled) just settles back.
      if (carried.value === id) {
        carried.value = null;
        runOnJS(onDragging)(false);
      }
      dy.value = withTiming(0, GLIDE);
      lifted.value = withTiming(0, GLIDE, () => {
        onTop.value = 0;
      });
    });

  const slot = useAnimatedStyle(() => ({
    zIndex: onTop.value ? 10 : 1,
    transform: [{ translateY: y.value + dy.value }],
  }));
  const row = useAnimatedStyle(() => ({ opacity: 1 - lifted.value }));
  const card = useAnimatedStyle(() => ({
    opacity: lifted.value,
    transform: [{ scale: 1 + 0.02 * lifted.value }],
    shadowOpacity: 0.14 * lifted.value,
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={slot}
        onLayout={(event) => {
          if (drawnAt === 0) rowHeight.value = event.nativeEvent.layout.height;
        }}
      >
        <Animated.View style={row}>
          <Row regular={regular} place={place} moved={moved} divider={divider} onPress={onPress} />
        </Animated.View>
        {/* Lifted: a card over the time column too, with the place it would take and a grip. */}
        <Animated.View
          pointerEvents="none"
          className="absolute top-0 bottom-0 flex-row items-center rounded-[16px] bg-white px-4"
          style={[
            card,
            {
              left: -48,
              right: 0,
              shadowColor: "#000",
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
            <Text className="text-[16px] leading-[21px] font-medium" numberOfLines={1}>
              {regular.customer.name}
            </Text>
            <Text className="text-[14px] leading-[19px] text-ink-2" numberOfLines={1}>
              {[
                regular.ground.name,
                place === null
                  ? null
                  : t("screens.regulars.reorder.place", { count: place, ordinal: true }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <IconGripVertical size={18} color={colors.ink3} strokeWidth={2} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function Row({
  regular,
  place,
  moved,
  divider,
  onPress,
}: {
  regular: Regular;
  place: number | null;
  // A reorder not yet saved puts it somewhere new: "now 2nd".
  moved: boolean;
  divider: boolean;
  onPress: () => void;
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
        ? confirmedLine(t, regular.reliability.confirmed, weeks)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-60 ${divider ? "border-b border-border" : ""}`}
    >
      <View className="flex-1">
        <Text
          className={`text-[16px] font-medium leading-[21px] ${paused ? "text-ink-2" : ""}`}
          numberOfLines={1}
        >
          {regular.customer.name}
        </Text>
        {/* One line, so a shared time's rows are all one height to glide between. */}
        <Text className="mt-0.5 text-[14px] leading-[19px] text-ink-2" numberOfLines={1}>
          {line}
        </Text>
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

// How the weeks have gone, said plainly (user, 2026-11-26: "confirmed 1 of 1 week" read oddly):
// "confirmed every week", "confirmed their first week", "hasn't confirmed a week yet", else
// "confirmed 7 of 8 weeks".
const confirmedLine = (t: TFunction, confirmed: number, weeks: number) =>
  confirmed === weeks
    ? t("screens.regulars.confirmedAll", { count: weeks })
    : confirmed === 0
      ? t("screens.regulars.confirmedNone", { count: weeks })
      : t("screens.regulars.confirmed", { confirmed, count: weeks });

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
