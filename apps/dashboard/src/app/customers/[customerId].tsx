import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, TextInput, View } from "react-native";
import type { components } from "@hagz/api";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { Field } from "@/components/field";
import { useHud } from "@/components/hud";
import { IconBrandWhatsapp, IconCalendarPlus, IconPencil, IconPhone } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { intlLocale } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { displayPhone, isolate } from "@/lib/phone";
import { hoursSpan } from "@/lib/when";
import { push } from "@/lib/navigation";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// A customer (Figma D11 619:2, edits 661:2): who they are, then Call, WhatsApp and Book; the team's
// note with Edit; their games still to come (a regular's week to confirm says Confirm) and the
// ones played, as the Calendar's rows, the last three and See all. A walk-in's name and number are
// the venue's to change (the pencil); an app player's follow their Hagz account.

type Customer = components["schemas"]["VenueCustomer"];
type Booking = components["schemas"]["StaffBooking"];
type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const PAGE = 20;
const SHOWN = 3;
const NOTE_MAX = 500;
const DIGITS = 10;
const UPCOMING = new Set(["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"]);
const PLAYED = new Set(["COMPLETED", "NO_SHOW", "CONFIRMED"]);

const localDigits = (phone: string) => phone.replace(/^\+20/, "");

function CustomerPage() {
  const { t } = useTranslation();
  const { customerId = "" } = useLocalSearchParams<{ customerId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const canEdit = venue?.permissions.customers === "manage";
  const canBook = venue?.permissions.bookings === "manage";
  const compact = useCompactTitle();
  const [sheet, setSheet] = useState<"note" | "details" | null>(null);
  const [showAll, setShowAll] = useState(false);

  const key = ["staff", "venues", venueId, "customers", customerId] as const;
  const customer = useQuery({
    queryKey: key,
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/customers/{customerId}", {
          params: { path: { venueId, customerId } },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: venueId !== "",
  });
  const bookings = useInfiniteQuery({
    queryKey: ["staff", "venues", venueId, "bookings", "customer", customerId],
    queryFn: async ({ pageParam }) => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/customers/{customerId}/bookings", {
          params: {
            path: { venueId, customerId },
            query: { limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) },
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

  const person = customer.data;
  if (!person) {
    return (
      <Screen>
        <NavBar
          flush
          start={
            <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
          }
        />
        {customer.isError ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.customer.failed")}</Text>
        ) : (
          <ActivityIndicator className="mt-10" color={colors.ink3} />
        )}
      </Screen>
    );
  }

  const now = Date.now();
  const all = bookings.data?.pages.flatMap((page) => page.data) ?? [];
  // Latest first from the API: the ones to come read soonest first.
  const upcoming = all
    .filter((one) => UPCOMING.has(one.status) && Date.parse(one.endsAt) > now)
    .reverse();
  const played = all.filter((one) => PLAYED.has(one.status) && Date.parse(one.endsAt) <= now);
  const shownPlayed = showAll ? played : played.slice(0, SHOWN);
  const firstName = person.name.trim().split(/\s+/)[0] ?? person.name;
  const since = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(
    new Date(person.createdAt),
  );
  const who = [
    person.phone ? isolate(displayPhone(localDigits(person.phone))) : null,
    t(person.app ? "screens.customer.onHagzSince" : "screens.customer.walkInSince", {
      date: since,
    }),
  ]
    .filter(Boolean)
    .join(" · ");
  const phone = person.phone;

  return (
    <Screen>
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={person.name}
            style={compact.style}
          />
        }
        end={
          canEdit && !person.app ? (
            <RoundButton
              icon={IconPencil}
              label={t("screens.customer.details.title", { name: firstName })}
              onPress={() => setSheet("details")}
            />
          ) : undefined
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Avatar name={person.name} size="page" />
        <Text
          accessibilityRole="header"
          className="mt-4 text-[26px] leading-[32px] font-semibold tracking-[-0.35px]"
          onLayout={compact.onTitleLayout}
        >
          {person.name}
        </Text>
        <Text className="mt-1 text-body text-ink-2">{who}</Text>

        <View className="mt-6 flex-row border-b border-border pb-6">
          {phone ? (
            <Action
              icon={IconPhone}
              label={t("screens.customer.call")}
              onPress={() => void Linking.openURL(`tel:${phone}`)}
            />
          ) : null}
          {phone ? (
            <Action
              icon={IconBrandWhatsapp}
              label={t("screens.customer.whatsapp")}
              onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}
            />
          ) : null}
          {canBook ? (
            <Action
              icon={IconCalendarPlus}
              label={t("screens.customer.book")}
              primary
              onPress={() =>
                push({
                  pathname: "/book",
                  params: { forId: person.id, forName: person.name },
                })
              }
            />
          ) : null}
        </View>

        {/* The team's note. */}
        <View className="border-b border-border py-6">
          <View className="flex-row items-center justify-between">
            <Heading>{t("screens.customer.note")}</Heading>
            {canEdit ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSheet("note")}
                className="active:opacity-60"
              >
                <Text className="text-label underline">
                  {person.note ? t("screens.customer.edit") : t("screens.customer.addNote")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text className={`mt-1.5 text-body ${person.note ? "" : "text-ink-2"}`}>
            {person.note ?? t("screens.customer.noNote")}
          </Text>
        </View>

        {!bookings.data ? (
          bookings.isError ? (
            <Text className="mt-6 text-body text-ink-2">{t("screens.customer.gamesFailed")}</Text>
          ) : (
            <ActivityIndicator className="mt-8" color={colors.ink3} />
          )
        ) : (
          <>
            {upcoming.length > 0 ? (
              <View className="mt-6">
                <Heading className="mb-3">{t("screens.customer.comingUp")}</Heading>
                {upcoming.map((booking) => (
                  <Game
                    key={booking.id}
                    booking={booking}
                    venueId={venueId}
                    upcoming
                    canConfirm={canBook}
                  />
                ))}
              </View>
            ) : null}
            <View className="mt-6 pb-6">
              <Heading className="mb-3">{t("screens.customer.played")}</Heading>
              {played.length === 0 ? (
                <Text className="text-body text-ink-2">{t("screens.customer.notPlayed")}</Text>
              ) : (
                shownPlayed.map((booking) => (
                  <Game key={booking.id} booking={booking} venueId={venueId} />
                ))
              )}
              {!showAll && (played.length > SHOWN || bookings.hasNextPage) ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    setShowAll(true);
                    void bookings.fetchNextPage();
                  }}
                  className="mt-2 self-start active:opacity-60"
                >
                  <Text className="text-label underline">
                    {t("screens.customer.seeAll", {
                      count: Math.max(person.bookingCount, played.length),
                    })}
                  </Text>
                </Pressable>
              ) : null}
              {showAll && bookings.hasNextPage ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={bookings.isFetchingNextPage}
                  onPress={() => void bookings.fetchNextPage()}
                  className="mt-2 self-start active:opacity-60"
                >
                  {bookings.isFetchingNextPage ? (
                    <ActivityIndicator color={colors.ink3} />
                  ) : (
                    <Text className="text-label underline">{t("screens.customer.more")}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </FadingScroll>

      <NoteSheet
        visible={sheet === "note"}
        customer={person}
        venueId={venueId}
        firstName={firstName}
        onClose={() => setSheet(null)}
      />
      <DetailsSheet
        visible={sheet === "details"}
        customer={person}
        venueId={venueId}
        firstName={firstName}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

// This page's section headings: 16 Semi Bold, a step under the app's 18 group headings, so a note
// and a few games read as one quiet page (user, 2026-11-26).
function Heading({ children, className = "" }: { children: string; className?: string }) {
  return (
    <Text accessibilityRole="header" className={`text-subtitle font-semibold ${className}`}>
      {children}
    </Text>
  );
}

// A round action with its label under it: grey, or blue for Book.
function Action({
  icon: Glyph,
  label,
  primary = false,
  onPress,
}: {
  icon: Icon;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-1 items-center active:opacity-70"
    >
      <View
        className={`size-[52px] items-center justify-center rounded-full ${primary ? "bg-primary" : "bg-chip"}`}
      >
        <Glyph size={24} color={primary ? colors.white : colors.ink} strokeWidth={1.9} />
      </View>
      <Text className="mt-2 text-label font-medium">{label}</Text>
    </Pressable>
  );
}

// One game as the Calendar writes it: the day beside a bar, the hours and ground, then what kind
// of booking it is. A regular's week waiting says Confirm, which confirms it here.
function Game({
  booking,
  venueId,
  upcoming = false,
  canConfirm = false,
}: {
  booking: Booking;
  venueId: string;
  upcoming?: boolean;
  // Confirming a regular's week needs bookings: manage (view only: no Confirm, D14 625:430).
  canConfirm?: boolean;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const at = new Date(booking.startsAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale, { timeZone: booking.timezone, ...options })
      .format(at)
      .replace(/[.,]/g, "");
  const confirm = async () => {
    setConfirming(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/reservations/{bookingId}/confirm", {
        params: { path: { venueId, bookingId: booking.id } },
      }),
    );
    if (!result.ok) hud.show(hudMessage(result.error));
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "regulars"] });
    await queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    setConfirming(false);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => push(`/booking/${booking.id}`)}
      className="mb-4 flex-row items-stretch active:opacity-60"
    >
      <View className="w-14">
        <Text className={`text-label font-medium ${upcoming ? "" : "text-ink-3"}`}>
          {part({ weekday: "short" })}
        </Text>
        <Text className="text-caption text-ink-3">{part({ day: "numeric", month: "short" })}</Text>
      </View>
      <View className={`me-3 w-[3px] rounded-full ${upcoming ? "bg-[#c9d6ff]" : "bg-border"}`} />
      <View className="flex-1 justify-center">
        <Text className={`text-body ${upcoming ? "" : "text-ink-2"}`}>
          {t("screens.customer.gameLine", {
            hours: hoursSpan(booking.startsAt, booking.endsAt, booking.timezone, t),
            ground: booking.ground.name ?? "",
          })}
        </Text>
        <Text className="text-caption text-ink-2">{kindOf(booking, t)}</Text>
      </View>
      {canConfirm && booking.status === "UNCONFIRMED" ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          disabled={confirming}
          onPress={() => void confirm()}
          className="ms-3 self-center active:opacity-60"
        >
          {confirming ? (
            <ActivityIndicator color={colors.ink3} />
          ) : (
            <Text className="text-label font-medium">{t("screens.customer.confirm")}</Text>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// "Weekly", "App · 900 EGP", "900 EGP", "No-show", "Waiting for you".
const kindOf = (booking: Booking, t: TFunction) => {
  const price = `${formatAmount(booking.total, decimalsOf(booking.currency))} ${booking.currency}`;
  if (booking.status === "NO_SHOW") return t("screens.customer.noShow");
  if (booking.status === "PENDING") return t("screens.customer.pending");
  if (booking.regular) return t("screens.customer.weekly");
  return booking.source === "APP" ? t("screens.customer.app", { price }) : price;
};

// The team's note about them (661:3 · Note): only the team sees it. Save stays grey until it changes.
function NoteSheet({
  visible,
  customer,
  venueId,
  firstName,
  onClose,
}: {
  visible: boolean;
  customer: Customer;
  venueId: string;
  firstName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [text, setText] = useState(customer.note ?? "");
  const [saving, setSaving] = useState(false);
  const saved = customer.note ?? "";
  // Each opening starts from what's saved.
  useEffect(() => {
    if (visible) setText(saved);
  }, [visible, saved]);

  const save = async (note: string) => {
    setSaving(true);
    const result = await send(
      api.PATCH("/v1/staff/venues/{venueId}/customers/{customerId}", {
        params: { path: { venueId, customerId: customer.id } },
        body: { note },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    queryClient.setQueryData(["staff", "venues", venueId, "customers", customer.id], result.data);
    void queryClient.invalidateQueries({
      queryKey: ["staff", "venues", venueId, "customers"],
      exact: false,
      predicate: (query) => query.queryKey[4] !== customer.id,
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.customer.noteSheet.title", { name: firstName })}
      </Text>
      <Text className="mt-1.5 mb-5 text-body text-ink-2">
        {t("screens.customer.noteSheet.subtitle")}
      </Text>
      <TextInput
        className="min-h-[120px] rounded-field border border-border px-4 pt-3.5 pb-3.5 text-[16px] leading-[22px] text-ink"
        style={{ textAlignVertical: "top" }}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={NOTE_MAX}
        placeholder={t("screens.customer.noteSheet.placeholder")}
        placeholderTextColor={colors.ink3}
        selectionColor={colors.primary}
      />
      <Text className="mt-1.5 self-end text-caption text-ink-3">
        {t("screens.customer.noteSheet.count", { count: text.length, max: NOTE_MAX })}
      </Text>
      {saved ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          disabled={saving}
          onPress={() => void save("")}
          className="mb-4 self-start active:opacity-60"
        >
          <Text className="text-body underline">{t("screens.customer.noteSheet.remove")}</Text>
        </Pressable>
      ) : null}
      <View className="mt-2">
        <Button
          label={t("screens.customer.save")}
          disabled={text.trim() === saved.trim()}
          loading={saving}
          onPress={() => void save(text.trim())}
        />
      </View>
    </Sheet>
  );
}

// A walk-in's name and number (661:3 · Name and number). A number another customer has says whose,
// with a way to open them.
function DetailsSheet({
  visible,
  customer,
  venueId,
  firstName,
  onClose,
}: {
  visible: boolean;
  customer: Customer;
  venueId: string;
  firstName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const savedDigits = customer.phone ? localDigits(customer.phone) : "";
  const [name, setName] = useState(customer.name);
  const [digits, setDigits] = useState(savedDigits);
  const [taken, setTaken] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName(customer.name);
    setDigits(savedDigits);
    setTaken(null);
  }, [visible, customer.name, savedDigits]);
  const changed = name.trim() !== customer.name || digits !== savedDigits;
  const ready = name.trim() !== "" && (digits === "" || digits.length === DIGITS);

  const save = async () => {
    setSaving(true);
    const result = await send(
      api.PATCH("/v1/staff/venues/{venueId}/customers/{customerId}", {
        params: { path: { venueId, customerId: customer.id } },
        body: { name: name.trim(), phone: digits === "" ? null : `+20${digits}` },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      const found = problem(result.error);
      if (found?.code === "CUSTOMER_EXISTS" && typeof found.customerId === "string") {
        setTaken({
          id: found.customerId,
          name: typeof found.customerName === "string" ? found.customerName : "",
        });
        return;
      }
      hud.show(hudMessage(result.error));
      return;
    }
    queryClient.setQueryData(["staff", "venues", venueId, "customers", customer.id], result.data);
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "customers"] });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="mb-6 text-[22px] font-semibold leading-[1.27]">
        {t("screens.customer.details.title", { name: firstName })}
      </Text>
      <Field
        label={t("screens.customer.details.name")}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        textContentType="name"
        maxLength={100}
      />
      <PhoneField
        label={t("screens.customer.details.mobile")}
        value={digits}
        onChangeText={(next) => {
          setDigits(next);
          setTaken(null);
        }}
      />
      {taken ? (
        <View className="-mt-2 mb-4 flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-caption">
            {taken.name
              ? t("screens.customer.details.takenBy", { name: taken.name })
              : t("screens.customer.details.taken")}
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              onClose();
              push(`/customers/${taken.id}`);
            }}
            className="active:opacity-60"
          >
            <Text className="text-caption underline">
              {taken.name
                ? t("screens.customer.details.openName", {
                    name: taken.name.trim().split(/\s+/)[0] ?? taken.name,
                  })
                : t("screens.customer.details.open")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text className="-mt-2 mb-4 text-caption text-ink-2">
          {t("screens.customer.details.hint")}
        </Text>
      )}
      <Button
        label={t("screens.customer.save")}
        disabled={!changed || !ready}
        loading={saving}
        onPress={() => void save()}
      />
    </Sheet>
  );
}

export default guarded(RULES.customers, CustomerPage);
