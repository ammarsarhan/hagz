import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { components } from "@hagz/api";
import { MAXIMUM_GROUNDS } from "@hagz/contracts";
import { Button } from "@/components/button";
import { DeleteGroundSheet } from "@/components/delete-ground-sheet";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconPlus } from "@/components/icons";
import { SetupLoading } from "@/components/setup-loading";
import { StepScreen } from "@/components/step-screen";
import { SwipeRow, useSwipeRows } from "@/components/swipe-row";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { groundLine, type Ground } from "@/lib/grounds";
import { isRTL } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { afterVenueWrite, queries } from "@/lib/queries";
import { push } from "@/lib/navigation";
import { calendarKey } from "@/lib/week-queries";

// Setup item "Grounds and prices" (Figma "Grounds · List", 351:2): every ground players can book,
// in order, each with what it is and its normal price per hour. Tapping one edits it; swiping it
// left shows Delete, like any iOS list. "Add a ground" walks through the four screens under
// [groundId]. Each change is saved as it's made, so Done only leaves.
type GroundRemoval = components["schemas"]["GroundRemoval"];

export default function SetupGrounds() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const venue = useQuery(queries.venue(venueId));
  const grounds = useQuery(queries.grounds(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  if (!grounds.data) return <SetupLoading query={grounds} />;
  return (
    <GroundsList
      venueId={venueId}
      currency={venue.data.marketplace.currency}
      grounds={grounds.data}
    />
  );
}

function GroundsList({
  venueId,
  currency,
  grounds,
}: {
  venueId: string;
  currency: string;
  grounds: Ground[];
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const decimals = decimalsOf(currency);
  const rows = useSwipeRows();
  const tap = (ground: Ground) => {
    if (!rows.closeOpen()) push(`/setup/${venueId}/grounds/${ground.id}`);
  };

  // Asked first (user, 2026-11-27): a sheet says what it leaves behind (bookings still to come go
  // ahead and keep it on the calendar, marked Deleted; its regulars end with it), and its Delete
  // asks once more in a short native alert. The ground is kept on the server for booking history,
  // but there's no bringing it back from the app. It leaves the list once the sheet has slid away;
  // a failure puts it back and says why.
  const [asking, setAsking] = useState<{
    ground: Ground;
    removal: GroundRemoval;
    row: SwipeableMethods | null;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const confirmed = useRef(false);

  const ask = async (ground: Ground, row: SwipeableMethods | null) => {
    const preview = await send(
      api.GET("/v1/staff/venues/{venueId}/grounds/{groundId}/removal", {
        params: { path: { venueId, groundId: ground.id } },
      }),
    );
    if (!preview.ok) {
      hud.show(hudMessage(preview.error));
      row?.close();
      rows.forget();
      return;
    }
    confirmed.current = false;
    setAsking({ ground, removal: preview.data, row });
    setSheetOpen(true);
  };

  const remove = async (ground: Ground) => {
    const key = queries.grounds(venueId).queryKey;
    queryClient.setQueryData(key, (list) => list?.filter((g) => g.id !== ground.id));
    const result = await send(
      api.DELETE("/v1/staff/venues/{venueId}/grounds/{groundId}", {
        params: { path: { venueId, groundId: ground.id } },
      }),
    );
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      // Not deleted: the grounds come back as the server has them.
      void afterVenueWrite(queryClient, venueId, { also: [key] });
      return;
    }
    // Already out of the list; its week goes from the cache, and the checklist and the draft card
    // follow.
    queryClient.removeQueries({
      queryKey: queries.schedule(venueId, ground.id).queryKey,
      exact: true,
    });
    void afterVenueWrite(queryClient, venueId);
    // The calendar's weeks: the ground now shows as Deleted there, or is gone.
    void queryClient.invalidateQueries({ queryKey: calendarKey(venueId, "slots") });
  };

  const sheetGone = () => {
    if (!asking) return;
    if (confirmed.current) void remove(asking.ground);
    else asking.row?.close();
    rows.forget();
    setAsking(null);
  };

  return (
    <StepScreen
      title={t("screens.setup.grounds.title")}
      subtitle={t("screens.setup.grounds.subtitle")}
      footer={<Button label={t("screens.setup.grounds.done")} onPress={() => router.back()} />}
    >
      {/* As in iOS lists: the rows span the screen, so a swipe opens Delete at its very edge, while
          the lines between them stay inset to the gutter. The lines sit between the rows rather
          than in them, so they stay put as a row slides and Delete fills the space between two. */}
      <View className="-mx-5">
        <View className="mx-5 h-px bg-border" />
        {grounds.map((ground) => (
          <Fragment key={ground.id}>
            <Row
              ground={ground}
              price={t("screens.setup.grounds.price", {
                currency,
                amount: formatAmount(ground.basePrice, decimals),
              })}
              onPress={() => tap(ground)}
              onOpen={rows.opened}
              onDelete={(row) => void ask(ground, row)}
            />
            <View className="mx-5 h-px bg-border" />
          </Fragment>
        ))}
      </View>
      {grounds.length < MAXIMUM_GROUNDS ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => push(`/setup/${venueId}/grounds/new`)}
          hitSlop={8}
          className="flex-row items-center gap-1.5 self-start py-4 active:opacity-60"
        >
          <IconPlus size={20} color={colors.primary} strokeWidth={2} />
          <Text className="text-body font-medium text-primary">
            {t("screens.setup.grounds.add")}
          </Text>
        </Pressable>
      ) : null}
      {asking ? (
        <DeleteGroundSheet
          name={asking.ground.name ?? t("screens.setup.grounds.unnamed")}
          removal={asking.removal}
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onHidden={sheetGone}
          onDelete={() => {
            confirmed.current = true;
            setSheetOpen(false);
          }}
        />
      ) : null}
    </StepScreen>
  );
}

function Row({
  ground,
  price,
  onPress,
  onOpen,
  onDelete,
}: {
  ground: Ground;
  price: string;
  onPress: () => void;
  onOpen: (row: SwipeableMethods | null) => void;
  onDelete: (row: SwipeableMethods | null) => void;
}) {
  const { t } = useTranslation();
  const name = ground.name ?? t("screens.setup.grounds.unnamed");
  const line = groundLine(t, ground);
  const perHour = t("screens.setup.grounds.perHour");
  return (
    <SwipeRow
      label={`${name}, ${line}, ${price}${perHour}`}
      deleteLabel={t("screens.setup.grounds.delete")}
      onPress={onPress}
      onOpen={onOpen}
      onDelete={onDelete}
    >
      <View className="flex-1">
        <Text className="text-subtitle font-medium leading-[1.31]">{name}</Text>
        <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">{line}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-body font-medium">{price}</Text>
        <Text className="text-body text-ink-2">{perHour}</Text>
        <IconChevronRight
          size={18}
          color={colors.ink3}
          style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      </View>
    </SwipeRow>
  );
}
