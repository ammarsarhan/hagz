import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { StepRail } from "@/components/step-rail";
import { Text } from "@/components/text";
import { moneyOf, NoteSheet, PriceSheet } from "@/components/time-sheets";
import { Chip } from "@/components/week-strip";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { localDateOf, weekStartOf, type Slot } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { kindOf } from "@/lib/grounds";
import { push } from "@/lib/navigation";
import { useNow } from "@/lib/use-now";
import { weekSlots } from "@/lib/week-queries";
import { dayLabel, hoursSpan, relativeDay, sentenceTime } from "@/lib/when";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// A time's own page (Figma D19 723:2; user 2026-11-27, in place of the calendar's sheets): one free
// hour, a run picked by dragging, the same hour free on several grounds (picked with chips), or a
// stretch staff closed. Its price and how it was set, closing it or who closed it and why, and
// Book and Hold (or Reopen) in the bar.
//
// It reads the week's slots the calendar already holds, so it opens at once and follows every change
// (a price, closing, reopening) without passing the slots along.

type Params = { date: string; slotIds: string };

const TIER = { BASE: "normal", PEAK: "peak", DISCOUNT: "discount" } as const;

function TimePage() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const hud = useHud();
  const queryClient = useQueryClient();
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const canBook = venue?.permissions.bookings === "manage";
  const canChange = venue?.permissions.schedule === "manage";
  const week = useQuery(
    weekSlots(
      venueId,
      weekStartOf(params.date),
      venueId !== "" && venue?.permissions.schedule !== "none",
    ),
  );
  const ids = params.slotIds.split(",");
  const all = (week.data?.slots ?? [])
    .filter((slot) => ids.includes(slot.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // The same hour on several grounds: one at a time, picked with chips.
  const grounds = [...new Set(all.map((slot) => slot.groundId))];
  const [picked, setPicked] = useState<string | null>(null);
  const groundId = picked !== null && grounds.includes(picked) ? picked : (grounds[0] ?? "");
  const slots = all.filter((slot) => slot.groundId === groundId);
  const ground = week.data?.grounds.find((one) => one.id === groundId);
  const timezone = week.data?.timezone ?? "Africa/Cairo";
  const currency = week.data?.currency ?? "EGP";
  const groundName = (id: string) => week.data?.grounds.find((one) => one.id === id)?.name ?? "";

  const [sheet, setSheet] = useState<"price" | "note" | null>(null);
  const [busy, setBusy] = useState(false);

  const first = slots[0];
  const last = slots.at(-1);
  // Booked or held meanwhile (or gone): nothing here to act on.
  const closed = slots.length > 0 && slots.every((slot) => slot.status === "BLOCKED");
  const free = slots.length > 0 && slots.every((slot) => slot.status === "AVAILABLE");
  if (!first || !last || (!closed && !free)) {
    return (
      <Screen>
        <NavBar
          flush
          start={
            <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
          }
        />
        {week.data ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.time.gone")}</Text>
        ) : null}
      </Screen>
    );
  }

  const p = "screens.time";
  const hours = hoursSpan(first.startsAt, last.endsAt, timezone, t);
  const total = slots.reduce((sum, slot) => sum + slot.price, 0);
  const samePrice = slots.every((slot) => slot.price === first.price);
  const ended = Date.parse(last.endsAt) <= now;
  const slotIds = slots.map((slot) => slot.id);
  const byHand = slots.some((slot) => slot.isManual);
  const day = relativeDay(localDateOf(first.startsAt, timezone), now, timezone, t);
  const subtitle =
    grounds.length > 1
      ? t(`${p}.manyGrounds`, { day, count: grounds.length })
      : [day, ground?.name, ground ? kindOf(t, ground) : null].filter(Boolean).join(" · ");
  const status = closed
    ? t(`${p}.closed`)
    : slots.length > 1
      ? t(`${p}.freeHours`, { count: slots.length })
      : t(`${p}.free`);

  const write = async (call: ReturnType<typeof send>) => {
    setBusy(true);
    const result = await call;
    setBusy(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] });
    return true;
  };
  const savePrice = async (price: number) => {
    const done = await write(
      send(
        api.PUT("/v1/staff/venues/{venueId}/slots/price", {
          params: { path: { venueId } },
          body: { slotIds, price },
        }),
      ),
    );
    if (done) setSheet(null);
  };
  const saveNote = async (note: string | null) => {
    const done = await write(
      send(
        api.PUT("/v1/staff/venues/{venueId}/slots/note", {
          params: { path: { venueId } },
          body: { slotIds, note },
        }),
      ),
    );
    if (done) setSheet(null);
  };
  const reopen = () =>
    void write(
      send(
        api.POST("/v1/staff/venues/{venueId}/slots/unblock", {
          params: { path: { venueId } },
          body: { slotIds },
        }),
      ),
    );
  const book = (pathname: "/book" | "/hold") =>
    push({
      pathname,
      params: { date: params.date, groundId, from: first.id, to: last.id },
    });
  const close = () =>
    push({
      pathname: "/close-time",
      params: {
        slotIds: slotIds.join(","),
        startsAt: first.startsAt,
        endsAt: last.endsAt,
        ground: groundName(groundId),
        price: String(total),
        currency,
        timezone,
      },
    });

  const title = hours;
  const bar = ended ? null : closed ? (
    canChange ? (
      <BottomBar title={t(`${p}.closedBar`)} detail={t(`${p}.closedBarBody`)}>
        <BarButton label={t(`${p}.reopen`)} primary busy={busy} onPress={reopen} />
      </BottomBar>
    ) : null
  ) : canBook ? (
    <BottomBar
      title={
        grounds.length > 1
          ? `${groundName(groundId)} · ${moneyOf(total, currency)}`
          : t(`${p}.freeBar`, { price: moneyOf(total, currency) })
      }
      // One booking only if a game here can run that long; else Book picks its first hours.
      detail={
        slots.length > 1 && slots.length <= (ground?.maximumSlots ?? 3)
          ? t(`${p}.oneBooking`)
          : t(`${p}.bookOrHold`)
      }
    >
      <View className="flex-row gap-2">
        <BarButton label={t(`${p}.hold`)} onPress={() => book("/hold")} />
        <BarButton label={t(`${p}.book`)} primary onPress={() => book("/book")} />
      </View>
    </BottomBar>
  ) : null;

  return (
    <Screen footer={bar}>
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
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Text className="text-label font-medium tracking-[0.4px]" onLayout={compact.onTitleLayout}>
          {status}
        </Text>
        <Text
          accessibilityRole="header"
          className="mt-1 text-title font-semibold tracking-[-0.4px]"
        >
          {title}
        </Text>
        <Text className="mt-1.5 text-subtitle text-ink-2">{subtitle}</Text>

        {grounds.length > 1 ? (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {grounds.map((id) => (
              <Chip
                key={id}
                label={groundName(id)}
                on={id === groundId}
                onPress={() => setPicked(id)}
              />
            ))}
          </View>
        ) : null}

        {closed ? (
          <>
            <Section title={t(`${p}.closedTitle`)}>
              <StepRail
                steps={[
                  {
                    label: first.closed?.by
                      ? t(`${p}.closedBy`, { name: first.closed.by })
                      : t(`${p}.closedByGone`),
                    detail: first.closed
                      ? dayLabel(localDateOf(first.closed.at, timezone), t)
                      : undefined,
                    when: first.closed ? sentenceTime(first.closed.at, timezone, t) : "",
                    state: "done",
                  },
                ]}
              />
            </Section>
            <Section title={t(`${p}.note`)}>
              {first.closed?.note ? (
                <>
                  <Text className="text-body">{first.closed.note}</Text>
                  <Text className="text-caption text-ink-2">{t(`${p}.noteBody`)}</Text>
                </>
              ) : (
                <Text className="text-body text-ink-2">{t(`${p}.noNote`)}</Text>
              )}
              {canChange ? (
                <Link
                  label={first.closed?.note ? t(`${p}.editNote`) : t(`${p}.addNote`)}
                  onPress={() => setSheet("note")}
                />
              ) : null}
            </Section>
          </>
        ) : null}

        <Section
          title={
            grounds.length > 1
              ? t(`${p}.priceOn`, { ground: groundName(groundId) })
              : t(`${p}.price`)
          }
        >
          {closed ? (
            <Line
              label={t(`${p}.whenReopens`)}
              value={samePrice ? moneyOf(first.price, currency) : moneyOf(total, currency)}
            />
          ) : (
            slots.map((slot) => (
              <Line
                key={slot.id}
                label={t(`${p}.hourTier`, {
                  hours: hoursSpan(slot.startsAt, slot.endsAt, timezone, t),
                  tier: t(`screens.setup.hours.${TIER[slot.tier]}`),
                })}
                value={moneyOf(slot.price, currency)}
              />
            ))
          )}
          {!closed && slots.length > 1 ? (
            <View className="mt-2 border-t border-border pt-2">
              <Line label={t(`${p}.total`)} value={moneyOf(total, currency)} strong />
            </View>
          ) : null}
          <Line label={t(`${p}.setBy`)} value={byHand ? t(`${p}.byHand`) : t(`${p}.byHours`)} />
          {canChange && !ended ? (
            <Link
              label={t(`${p}.changePrice`)}
              detail={slots.length > 1 ? t(`${p}.samePrice`) : undefined}
              onPress={() => setSheet("price")}
            />
          ) : null}
        </Section>

        {!closed && canChange && !ended ? (
          <Section title={t(`${p}.offSale`)}>
            <Text className="text-label text-ink-2">
              {grounds.length > 1
                ? t(`${p}.offSaleOne`, { ground: groundName(groundId) })
                : t(`${p}.offSaleBody`, { count: slots.length })}
            </Text>
            <Link label={t(`${p}.close`, { count: slots.length })} onPress={close} />
          </Section>
        ) : null}
      </FadingScroll>

      {/* Keyed by what they change, so each opens with its own price or note. */}
      <PriceSheet
        key={`price:${slotIds.join(",")}:${first.price}`}
        title={`${hours} · ${groundName(groundId)}`}
        current={samePrice ? first.price : null}
        currency={currency}
        visible={sheet === "price"}
        busy={busy}
        onClose={() => setSheet(null)}
        onHidden={() => undefined}
        onSave={(price) => void savePrice(price)}
      />
      <NoteSheet
        key={`note:${slotIds.join(",")}:${first.closed?.note ?? ""}`}
        note={first.closed?.note ?? null}
        visible={sheet === "note"}
        busy={busy}
        onClose={() => setSheet(null)}
        onHidden={() => undefined}
        onSave={(note) => void saveNote(note)}
      />
    </Screen>
  );
}

// As on a booking's page: a hairline above, a heading, then its lines.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5 border-t border-border pt-5">
      <GroupHeading className="mb-3">{title}</GroupHeading>
      {children}
    </View>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-baseline py-1">
      <Text className={`flex-1 text-body ${strong ? "" : "text-ink-2"}`}>{label}</Text>
      <Text className={`ms-4 text-body ${strong ? "font-semibold" : ""}`}>{value}</Text>
    </View>
  );
}

// An underlined action under a section's lines, with an optional grey line under it.
function Link({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      className="mt-3 self-start active:opacity-70"
    >
      <Text className="text-body font-medium underline">{label}</Text>
      {detail ? <Text className="text-caption text-ink-2">{detail}</Text> : null}
    </Pressable>
  );
}

export default guarded(RULES.time, TimePage);
