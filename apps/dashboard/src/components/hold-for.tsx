import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { Field } from "./field";
import { useHud } from "./hud";
import { IconSearch } from "./icons";
import { PhoneField } from "./phone-field";
import { Sheet } from "./sheet";
import { Text } from "./text";
import { Tile } from "./tile";

// Who a held time is for (Figma D9): first two drawn paths, nothing to fill in yet (600:142), then
// either the venue's customers, searched by name or number with who played last listed first, where
// tapping one holds it (600:220), or someone new by name and mobile number (600:309). One sheet
// after another, each opened once the last has slid away. A hold made, the sheet slides away and
// `onHeld` gets the held booking. Failures (the time taken meanwhile, say) go to the HUD.

type Customer = components["schemas"]["VenueCustomer"];
type Held = components["schemas"]["StaffBookingDetail"];
type Step = "who" | "customers" | "new";

export interface HoldTarget {
  groundId: string;
  startsAt: string;
  endsAt: string;
}

const SOFT = "#c9d6ff";
const SOFT_FILL = "#f2f4ff";
const ART = { width: 120, height: 66 };
const RECENT = 8;
// How long typing pauses before it's searched.
const PAUSE_MS = 300;
const DIGITS = 10;

// "+201013372648" → "+20 101 337 2648".
const shownPhone = (phone: string) => {
  const match = /^\+20(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+20 ${match[1]} ${match[2]} ${match[3]}` : phone;
};

export function HoldFor({
  venueId,
  target,
  when,
  holdMinutes,
  onClose,
  onHeld,
}: {
  venueId: string;
  // The time being held; null while none is picked.
  target: HoldTarget | null;
  // "Today, 8 – 9 pm on Pitch 2".
  when: string;
  holdMinutes: number | null;
  onClose: () => void;
  onHeld: (held: Held) => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  // The sheet showing, and the one to show once it has slid away.
  const [step, setStep] = useState<Step | null>(null);
  const following = useRef<Step | "done" | null>(null);
  const held = useRef<Held | null>(null);
  const [holding, setHolding] = useState<string | null>(null);

  useEffect(() => {
    if (target) setStep("who");
  }, [target]);

  const go = (next: Step | "done" | null) => {
    following.current = next;
    setStep(null);
  };
  const hidden = () => {
    const next = following.current;
    following.current = null;
    if (next === "done") {
      const booking = held.current;
      held.current = null;
      if (booking) onHeld(booking);
    } else if (next) setStep(next);
    else onClose();
  };

  const hold = async (customer: { venueCustomerId: string } | { name: string; phone: string }) => {
    if (!target) return;
    setHolding("venueCustomerId" in customer ? customer.venueCustomerId : "new");
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/holds", {
        params: { path: { venueId } },
        body: { ...target, customer },
      }),
    );
    setHolding(null);
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] });
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    held.current = result.data;
    go("done");
  };

  const sheet = (which: Step) => ({
    visible: step === which,
    onClose: () => go(null),
    onHidden: hidden,
    closeLabel: t("components.shared.nav.close"),
  });

  return (
    <>
      <Sheet {...sheet("who")}>
        <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
          {t("screens.hold.who.title")}
        </Text>
        <Text className="mt-1.5 mb-6 text-body text-ink-2">{when}</Text>
        <View className="mb-2 flex-row gap-3">
          <Tile
            title={t("screens.hold.who.customers")}
            body={t("screens.hold.who.customersBody")}
            art={<CustomersArt />}
            onPress={() => go("customers")}
          />
          <Tile
            title={t("screens.hold.who.new")}
            body={t("screens.hold.who.newBody")}
            art={<NewArt />}
            onPress={() => go("new")}
          />
        </View>
      </Sheet>

      <Sheet
        {...sheet("customers")}
        scrollable
        onBack={() => go("who")}
        backLabel={t("components.shared.nav.back")}
      >
        <Customers
          venueId={venueId}
          when={when}
          holding={holding}
          onPick={(customer) => void hold({ venueCustomerId: customer.id })}
        />
      </Sheet>

      <Sheet {...sheet("new")} onBack={() => go("who")} backLabel={t("components.shared.nav.back")}>
        <NewCustomer
          when={when}
          holdMinutes={holdMinutes}
          holding={holding === "new"}
          onHold={(name, phone) => void hold({ name, phone })}
        />
      </Sheet>
    </>
  );
}

// The venue's customers: who played last first, or those matching what's typed.
function Customers({
  venueId,
  when,
  holding,
  onPick,
}: {
  venueId: string;
  when: string;
  holding: string | null;
  onPick: (customer: Customer) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const typed = text.trim();
  // Searched once typing pauses; cleared, back to the recent ones at once.
  useEffect(() => {
    if (typed === "") {
      setQ("");
      return;
    }
    const timer = setTimeout(() => setQ(typed), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const customers = useQuery({
    queryKey: ["staff", "venues", venueId, "customers", { q, order: q ? "name" : "recent" }],
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/customers", {
          params: {
            path: { venueId },
            query: q ? { q, limit: 30 } : { order: "recent", limit: RECENT },
          },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data.data;
    },
    placeholderData: keepPreviousData,
  });
  // What's typed isn't answered yet: still pausing, or asked and on its way. The last answer
  // (kept meanwhile) isn't shown for it, so no rows show for something not typed.
  const searching = typed !== q || customers.isPlaceholderData || customers.isLoading;

  return (
    <>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.hold.customers.title")}
      </Text>
      <Text className="mt-1.5 mb-5 text-body text-ink-2">
        {t("screens.hold.customers.for", { when })}
      </Text>
      <View className="h-12 flex-row items-center rounded-xl bg-field px-3.5">
        <IconSearch size={20} color={colors.ink2} strokeWidth={1.75} />
        <TextInput
          className="ms-2.5 flex-1 text-[16px] text-ink"
          value={text}
          onChangeText={setText}
          placeholder={t("screens.hold.customers.search")}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => setQ(typed)}
        />
      </View>
      <Text className="mt-6 mb-2 text-label text-ink-2">
        {typed ? t("screens.hold.customers.matches") : t("screens.hold.customers.recent")}
      </Text>
      {customers.isError && !customers.data ? (
        <Text className="text-body text-ink-2">{t("screens.hold.customers.failed")}</Text>
      ) : searching || !customers.data ? (
        <ActivityIndicator className="my-10" color={colors.ink3} />
      ) : customers.data.length === 0 ? (
        q ? (
          <View className="items-center pt-6 pb-4">
            <NoMatchArt />
            <Text className="mt-4 text-center text-body text-ink-2" style={{ maxWidth: "75%" }}>
              {t("screens.hold.customers.noMatch")}
            </Text>
          </View>
        ) : (
          <Text className="text-body text-ink-2" style={{ maxWidth: "75%" }}>
            {t("screens.hold.customers.none")}
          </Text>
        )
      ) : (
        customers.data.map((customer) => (
          <Pressable
            key={customer.id}
            accessibilityRole="button"
            accessibilityLabel={t("screens.hold.customers.holdFor", { name: customer.name })}
            disabled={holding !== null}
            onPress={() => onPick(customer)}
            className="flex-row items-center py-2.5 active:opacity-70"
          >
            <Avatar name={customer.name} size="row" />
            <View className="ms-3 flex-1">
              <Text className="text-body">{customer.name}</Text>
              <Text className="text-caption text-ink-2">
                {[
                  customer.phone ? shownPhone(customer.phone) : null,
                  customer.bookingCount > 0
                    ? t("screens.hold.customers.games", { count: customer.bookingCount })
                    : t("screens.hold.customers.newHere"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {holding === customer.id ? <ActivityIndicator color={colors.ink3} /> : null}
          </Pressable>
        ))
      )}
    </>
  );
}

// Someone the venue doesn't have yet: a name and a mobile number, then hold.
function NewCustomer({
  when,
  holdMinutes,
  holding,
  onHold,
}: {
  when: string;
  holdMinutes: number | null;
  holding: boolean;
  onHold: (name: string, phone: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const ready = name.trim() !== "" && digits.length === DIGITS;
  return (
    <>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.hold.new.title")}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">{when}</Text>
      <Field
        value={name}
        onChangeText={setName}
        placeholder={t("screens.hold.new.name")}
        accessibilityLabel={t("screens.hold.new.name")}
        autoCapitalize="words"
        textContentType="name"
        maxLength={100}
      />
      <PhoneField
        value={digits}
        onChangeText={setDigits}
        placeholder={t("screens.hold.new.mobile")}
      />
      <View className="mt-2">
        <Button
          label={
            holdMinutes === null
              ? t("screens.hold.new.holdPlain")
              : t("screens.hold.new.hold", { count: holdMinutes })
          }
          disabled={!ready}
          loading={holding}
          onPress={() => onHold(name.trim(), `+20${digits}`)}
        />
      </View>
    </>
  );
}

// Nobody found: an empty row under a magnifying glass.
function NoMatchArt() {
  return (
    <Svg width={140} height={84} viewBox="0 0 140 84">
      <Rect
        x={14.5}
        y={22.5}
        width={96}
        height={34}
        rx={9}
        fill={SOFT_FILL}
        stroke={SOFT}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <Circle cx={32} cy={39.5} r={6} fill={SOFT} />
      <Rect x={44} y={34} width={36} height={3.5} rx={1.75} fill={SOFT} />
      <Rect x={44} y={41.5} width={22} height={3} rx={1.5} fill={SOFT} />
      {/* The glass, over the row's end. */}
      <Circle
        cx={104}
        cy={36}
        r={15}
        fill={colors.white}
        stroke={colors.primary}
        strokeWidth={2.4}
      />
      <Path d="M115 47 L126 58" stroke={colors.primary} strokeWidth={3.2} strokeLinecap="round" />
      <Path
        d="M99 31 L109 41 M109 31 L99 41"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// A list of customers, one picked out in blue.
function CustomersArt() {
  return (
    <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Rect x={22} y={2} width={76} height={16} rx={5} fill={SOFT_FILL} />
      <Circle cx={31} cy={10} r={3.5} fill={SOFT} />
      <Rect x={39} y={7} width={26} height={2.5} rx={1.25} fill={SOFT} />
      <Rect x={39} y={12} width={16} height={2} rx={1} fill={SOFT} />
      <Rect x={14} y={23} width={92} height={20} rx={6} fill={colors.primary} />
      <Circle cx={25} cy={33} r={4.5} fill={colors.white} />
      <Rect x={35} y={29} width={34} height={3} rx={1.5} fill={colors.white} />
      <Rect x={35} y={35} width={20} height={2.5} rx={1.25} fill={colors.white} opacity={0.7} />
      <Rect x={22} y={48} width={76} height={16} rx={5} fill={SOFT_FILL} />
      <Circle cx={31} cy={56} r={3.5} fill={SOFT} />
      <Rect x={39} y={53} width={26} height={2.5} rx={1.25} fill={SOFT} />
      <Rect x={39} y={58} width={16} height={2} rx={1} fill={SOFT} />
    </Svg>
  );
}

// An empty card waiting for someone, a + on its corner.
function NewArt() {
  return (
    <Svg width={ART.width} height={ART.height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Rect
        x={18.5}
        y={14.5}
        width={83}
        height={41}
        rx={7}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <Circle
        cx={33}
        cy={31}
        r={6}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.2}
        strokeDasharray="2.5 2.5"
      />
      <Rect x={45} y={27} width={32} height={3} rx={1.5} fill={SOFT} />
      <Rect x={45} y={33} width={20} height={2.5} rx={1.25} fill={SOFT} />
      <Rect x={27} y={44} width={58} height={3} rx={1.5} fill={SOFT} />
      <Circle cx={101} cy={14} r={9} fill={colors.primary} stroke={colors.white} strokeWidth={2} />
      <Path
        d="M101 10 V18 M97 14 H105"
        stroke={colors.white}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
