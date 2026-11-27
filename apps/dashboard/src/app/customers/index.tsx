import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Animated, Pressable, SectionList, TextInput, View } from "react-native";
import type { components } from "@hagz/api";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { TopHairline } from "@/components/fading-scroll";
import { Empty } from "@/components/empty";
import { NoCustomersArt } from "@/components/empty-art";
import { NewCustomer, NoMatchArt, PAUSE_MS } from "@/components/hold-for";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconPlus, IconSearch } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { intlLocale, isRTL } from "@/lib/language";
import { push } from "@/lib/navigation";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// The venue's customers (Figma D11 557:2), from the Venue tab: A to Z under their first letters,
// searched by name or number. Each row: the name (Walk-in for someone staff entered), how many
// games and when last, and the team's note. A page at a time, the next as the list nears its end.
// + adds someone by name and number (customers: manage).

type Customer = components["schemas"]["VenueCustomer"];
const PAGE = 50;
const DAY_MS = 86_400_000;

function Customers() {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const canAdd = venue?.permissions.customers === "manage";
  const compact = useCompactTitle();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const typed = text.trim();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Searched once typing pauses; cleared, back to everyone at once.
  useEffect(() => {
    if (typed === "") {
      setQ("");
      return;
    }
    const timer = setTimeout(() => setQ(typed), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const list = useInfiniteQuery({
    queryKey: ["staff", "venues", venueId, "customers", { q, order: "name" }],
    queryFn: async ({ pageParam }) => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/customers", {
          params: {
            path: { venueId },
            query: {
              order: "name",
              limit: PAGE,
              ...(q ? { q } : {}),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: venueId !== "",
  });

  // Everyone, for the subtitle, whatever is typed (one row asked for, only its total read).
  const everyone = useQuery({
    queryKey: ["staff", "venues", venueId, "customers", "total"],
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/customers", {
          params: { path: { venueId }, query: { order: "name", limit: 1 } },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data.total;
    },
    enabled: venueId !== "",
  });

  const searching = typed !== q || (list.isFetching && !list.isFetchingNextPage);
  const sections = useMemo(() => {
    const groups: { title: string; data: Customer[] }[] = [];
    for (const customer of list.data?.pages.flatMap((page) => page.data) ?? []) {
      const letter = initialOf(customer.name);
      const last = groups.at(-1);
      if (last && last.title === letter) last.data.push(customer);
      else groups.push({ title: letter, data: [customer] });
    }
    return groups;
  }, [list.data]);

  const add = async (name: string, phone: string) => {
    setSaving(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/customers", {
        params: { path: { venueId } },
        body: { name, phone },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "customers"] });
    setAdding(false);
  };

  const title = t("screens.customers.title");
  const header = (
    <View>
      <Title
        small
        onTitleLayout={compact.onTitleLayout}
        subtitle={
          everyone.data === undefined
            ? t("screens.customers.subtitle")
            : t("screens.customers.count", { count: everyone.data })
        }
      >
        {title}
      </Title>
      <View className="mb-2 h-12 flex-row items-center rounded-xl bg-field px-3.5">
        <IconSearch size={20} color={colors.ink2} strokeWidth={1.75} />
        <TextInput
          className="ms-2.5 flex-1 text-[16px] text-ink"
          value={text}
          onChangeText={setText}
          placeholder={t("screens.customers.search")}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => setQ(typed)}
        />
      </View>
    </View>
  );

  const empty =
    searching || list.isPending ? (
      <ActivityIndicator className="my-10" color={colors.ink3} />
    ) : list.isError ? (
      <Text className="mt-4 text-body text-ink-2">{t("screens.customers.failed")}</Text>
    ) : q ? (
      <View className="items-center pt-8">
        <NoMatchArt />
        <Text className="mt-3 text-center text-body text-ink-2" style={{ maxWidth: "75%" }}>
          {t("screens.hold.customers.noMatch")}
        </Text>
      </View>
    ) : (
      <Empty
        art={<NoCustomersArt scale={0.8} />}
        title={t("screens.customers.noneTitle")}
        body={t("screens.customers.none")}
        action={
          canAdd
            ? { label: t("screens.customers.addButton"), onPress: () => setAdding(true) }
            : undefined
        }
      />
    );

  return (
    <Screen>
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
              label={t("screens.customers.add")}
              onPress={() => setAdding(true)}
            />
          ) : undefined
        }
      />
      {/* Full width, so the line under the bar spans the gutters, as on every other screen. */}
      <View className="-mx-5 flex-1">
        <SectionList
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          sections={searching ? [] : sections}
          keyExtractor={(customer) => customer.id}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator className="my-6" color={colors.ink3} />
            ) : undefined
          }
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: compact.scrollY } } }], {
            // A plain list (its typing is simpler), so the title follows on the JS side.
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          renderSectionHeader={({ section }) => (
            <Text className="mt-5 text-label font-medium text-ink-2">{section.title}</Text>
          )}
          renderItem={({ item, index, section }) => (
            <Row customer={item} last={index === section.data.length - 1} />
          )}
        />
        <TopHairline scrollY={compact.scrollY} />
      </View>
      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        closeLabel={t("components.shared.nav.close")}
      >
        <NewCustomer
          when={t("screens.customers.newBody")}
          holdMinutes={null}
          holding={saving}
          label={t("screens.customers.addButton")}
          onHold={(name, phone) => void add(name, phone)}
        />
      </Sheet>
    </Screen>
  );
}

// The letter a name files under: its first letter, capitalised; "#" for a digit or a sign.
const initialOf = (name: string) => {
  const first = name.trim().charAt(0).toLocaleUpperCase(intlLocale);
  return /\p{L}/u.test(first) ? first : "#";
};

function Row({ customer, last }: { customer: Customer; last: boolean }) {
  const { t } = useTranslation();
  const record = [
    customer.bookingCount > 0
      ? t("screens.customers.played", { count: customer.bookingCount })
      : t("screens.customers.notYet"),
    customer.lastBookedAt ? lastLabel(customer.lastBookedAt, t) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => push(`/customers/${customer.id}`)}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-60 ${last ? "" : "border-b border-border"}`}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="shrink text-[15px] font-medium leading-[1.33]" numberOfLines={1}>
            {customer.name}
          </Text>
          {customer.app ? null : (
            <View className="rounded-full bg-field px-1.5 py-px">
              <Text className="text-[11px] leading-[14px] text-ink-2">
                {t("screens.customers.walkIn")}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 text-caption text-ink-2">{record}</Text>
        {customer.note ? (
          <Text className="mt-0.5 text-caption text-ink-2" numberOfLines={1}>
            {t("screens.customers.note", { note: customer.note })}
          </Text>
        ) : null}
      </View>
      <IconChevronRight
        size={18}
        color={colors.unit}
        strokeWidth={2}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </Pressable>
  );
}

// When they last played, on this phone's clock: "last today", "last yesterday", "last on Sunday"
// within the week, else "last 1 Nov" (with the year when it isn't this one).
const lastLabel = (at: string, t: TFunction) => {
  const date = new Date(at);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const days = Math.round((startOf(now) - startOf(date)) / DAY_MS);
  if (days <= 0) return t("screens.customers.lastToday");
  if (days === 1) return t("screens.customers.lastYesterday");
  if (days < 7)
    return t("screens.customers.lastOn", {
      day: new Intl.DateTimeFormat(intlLocale, { weekday: "long" }).format(date),
    });
  return t("screens.customers.lastDate", {
    date: new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    }).format(date),
  });
};

export default guarded(RULES.customers, Customers);
