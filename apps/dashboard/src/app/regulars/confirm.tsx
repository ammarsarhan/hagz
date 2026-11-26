import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { HoldFor, shownPhone, type Choice } from "@/components/hold-for";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { StepRail } from "@/components/step-rail";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { useCurrentVenue } from "@/lib/current-venue";
import { hourLabel } from "@/lib/hours";
import { intlLocale } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { datesLabel } from "@/lib/regulars";

// A new weekly game's last look (Figma D12 656:93), after its time and who it's for: the time as a
// dashed card with Change (back to the picker), who it's for, the first and last week, and what
// happens next on the step rail: the weeks reserved (and any taken, skipped), each week waiting for
// a confirm by the venue's deadline, and the week going back on sale if nobody confirms. The bar
// says who and that it's paid at the venue, with Add regular. Added, the Regulars list takes the
// flow's place.

type Params = {
  groundId: string;
  ground: string;
  kind: string;
  dayOfWeek: string;
  startHour: string;
  slotCount: string;
  price: string;
  currency: string;
  // The weeks ahead, from the first, and whether each was free ("1") or taken ("0").
  dates: string;
  free: string;
  name: string;
  phone: string;
  customer: string;
};

type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";
const FALLBACK_WINDOW = 24;

export default function ConfirmRegular() {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<Params>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const confirmWindow = useQuery(bookingSettingsQuery(venueId)).data?.confirmationWindow;
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  // One object while asked: HoldFor opens its first sheet again whenever the target changes.
  const target = useMemo(
    () => (asking ? { groundId: params.groundId, startsAt: "", endsAt: "" } : null),
    [asking, params.groundId],
  );

  const dayOfWeek = Number(params.dayOfWeek);
  const startHour = Number(params.startHour);
  const slotCount = Number(params.slotCount);
  const dates = params.dates.split(",");
  const free = params.free.split(",");
  const reserved = dates.filter((_, index) => free[index] === "1");
  const taken = dates.filter((_, index) => free[index] !== "1");
  const first = dates[0] ?? "";
  const day = t(`screens.regulars.days.${String(dayOfWeek) as Weekday}`);
  const hours = `${hourLabel(t, startHour)} – ${hourLabel(t, startHour + slotCount)}`;
  const money = `${formatAmount(Number(params.price), decimalsOf(params.currency))} ${params.currency}`;
  const short = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "short" });
  const dayMonth = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const long = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "long" });

  // The deadline, so many hours before kick-off: "By the Monday before, 8 pm", or the same day.
  const deadline = (() => {
    const before = startHour - (confirmWindow ?? FALLBACK_WINDOW);
    const daysBack = Math.floor(before / 24);
    const hour = hourLabel(t, before);
    if (daysBack === 0) return t("screens.regulars.confirm.bySameDay", { hour });
    // A Sunday in January 2026, moved to the deadline's weekday.
    const weekday = new Date(Date.UTC(2026, 0, 4 + ((((dayOfWeek + daysBack) % 7) + 7) % 7)));
    return t("screens.regulars.confirm.byBefore", { day: long.format(weekday), hour });
  })();

  const firstDate = (dates_: string[]) =>
    dates_[0] ? `${short.format(new Date(`${dates_[0]}T12:00:00Z`))} ` : "";

  const add = async () => {
    setSending(true);
    const customer = JSON.parse(params.customer) as Choice["customer"];
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/regulars", {
        params: { path: { venueId } },
        body: {
          customer,
          groundId: params.groundId,
          dayOfWeek,
          startHour,
          slotCount,
          startsOn: first,
        },
      }),
    );
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "regulars"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "customers"] });
    // On success it keeps spinning until the list takes over.
    if (!result.ok) {
      setSending(false);
      hud.show(hudMessage(result.error));
      return;
    }
    router.dismissTo("/regulars");
  };

  const title = t("screens.regulars.confirm.title");
  const c = "screens.regulars.confirm";

  return (
    <Screen
      footer={
        <BottomBar title={params.name} detail={t("screens.book.paidHere")}>
          <BarButton label={t(`${c}.add`)} primary busy={sending} onPress={() => void add()} />
        </BottomBar>
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
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={t(`${c}.subtitle`, {
            name: params.name,
            weekday: long.format(new Date(Date.UTC(2026, 0, 4 + dayOfWeek))),
            hour: hourLabel(t, startHour),
          })}
        >
          {title}
        </Title>

        {/* The time picked, with the way back to change it. */}
        <View className="flex-row items-center rounded-[14px] border-[1.5px] border-dashed border-primary bg-[#f7f8ff] px-3.5 py-2.5">
          <View className="flex-1">
            <Text className="text-[16px] leading-[21px] font-medium">
              {t(`${c}.time`, { day, hours })}
            </Text>
            {/* The ground on a line of its own, under the time (user, 2026-11-26). */}
            <Text className="text-[15px] leading-5">{params.ground}</Text>
            <Text className="text-[13px] leading-[17px] text-ink-2">
              {[t(`${c}.perWeek`, { price: money }), params.kind].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Change onPress={() => router.back()} />
        </View>

        <Fact
          label={t(`${c}.for`)}
          value={params.name}
          detail={params.phone ? shownPhone(params.phone) : undefined}
          onChange={() => setAsking(true)}
        />
        <Fact
          label={t(`${c}.firstWeek`)}
          value={first ? dayMonth.format(new Date(`${first}T12:00:00Z`)) : ""}
          onChange={() => hud.show(t("common.comingNext"))}
        />
        <Fact
          label={t(`${c}.lastWeek`)}
          value={t(`${c}.noEnd`)}
          onChange={() => hud.show(t("common.comingNext"))}
        />

        <GroupHeading className="mt-6 mb-4">{t(`${c}.next`)}</GroupHeading>
        <StepRail
          steps={[
            {
              label: t(`${c}.reserved`, {
                count: reserved.length,
                dates: `${firstDate(reserved)}${datesLabel(t, reserved)}`,
              }),
              detail:
                taken.length > 0
                  ? t(`${c}.skipped`, { count: taken.length, dates: datesLabel(t, taken) })
                  : undefined,
              when: "",
              state: "now",
              bold: "label",
            },
            { label: t(`${c}.waits`), detail: deadline, when: "", state: "next" },
            { label: t(`${c}.missed`), detail: t(`${c}.backOnSale`), when: "", state: "maybe" },
          ]}
        />
      </FadingScroll>

      {/* Someone else: the same sheets as before, then back here with them. */}
      <HoldFor
        venueId={venueId}
        target={target}
        when={t("screens.regulars.new.when", { day, hours, ground: params.ground })}
        holdMinutes={null}
        onClose={() => setAsking(false)}
        onChoose={(choice) => {
          setAsking(false);
          router.setParams({
            name: choice.name,
            phone: choice.phone ?? "",
            customer: JSON.stringify(choice.customer),
          });
        }}
      />
    </Screen>
  );
}

// One of the facts: what it is in grey, the value under it, Change at its end, a hairline under.
function Fact({
  label,
  value,
  detail,
  onChange,
}: {
  label: string;
  value: string;
  // A grey line under the value: the number under the name (user, 2026-11-26).
  detail?: string;
  onChange: () => void;
}) {
  return (
    <View className="flex-row items-end border-b border-border pt-4 pb-2">
      <View className="flex-1">
        <Text className="text-[14px] leading-[19px] font-medium text-ink-2">{label}</Text>
        <Text className="mt-1 text-[16px] leading-[21px] font-medium" numberOfLines={1}>
          {value}
        </Text>
        {detail ? (
          <Text className="text-[14px] leading-[19px] text-ink-2" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Change onPress={onChange} grey />
    </View>
  );
}

// Grey and a touch smaller on the facts; ink on the time card (user, 2026-11-26).
function Change({ onPress, grey = false }: { onPress: () => void; grey?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      className="ms-3 active:opacity-70"
    >
      <Text
        className={`font-medium underline ${grey ? "text-[14px] leading-[19px] text-ink-2" : "text-[15px] leading-5"}`}
      >
        {t("screens.regulars.confirm.change")}
      </Text>
    </Pressable>
  );
}
