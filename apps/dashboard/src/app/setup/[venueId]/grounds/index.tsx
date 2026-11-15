import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { MAXIMUM_GROUNDS } from "@hagz/contracts";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconPlus, IconTrash } from "@/components/icons";
import { SetupLoading } from "@/components/setup-loading";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { groundLine, type Ground } from "@/lib/grounds";
import { isRTL } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { queries } from "@/lib/queries";

// Setup item "Grounds and prices" (Figma "Grounds · List", 351:2): every ground players can book,
// in order, each with what it is and its normal price per hour. Tapping one edits it; swiping it
// left shows Delete, like any iOS list. "Add a ground" walks through the four screens under
// [groundId]. Each change is saved as it's made, so Done only leaves.
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
  // The row swiped open, if any. Like iOS, opening another closes it, and tapping a row while one
  // is open just closes that one.
  const open = useRef<SwipeableMethods | null>(null);

  const opened = (row: SwipeableMethods | null) => {
    if (open.current && open.current !== row) open.current.close();
    open.current = row;
  };
  const tap = (ground: Ground) => {
    if (open.current) {
      open.current.close();
      open.current = null;
      return;
    }
    router.push(`/setup/${venueId}/grounds/${ground.id}`);
  };

  // Asked first: the ground is kept on the server for booking history, but there's no bringing it
  // back from the app. It leaves the list straight away; a failure puts it back and says why.
  const remove = (ground: Ground, row: SwipeableMethods | null) => {
    const close = () => {
      row?.close();
      open.current = null;
    };
    Alert.alert(
      t("screens.setup.grounds.deleteTitle", {
        name: ground.name ?? t("screens.setup.grounds.unnamed"),
      }),
      t("screens.setup.grounds.deleteBody"),
      [
        { text: t("screens.setup.grounds.cancel"), style: "cancel", onPress: close },
        {
          text: t("screens.setup.grounds.deleteConfirm"),
          style: "destructive",
          onPress: () => {
            open.current = null;
            void (async () => {
              const key = queries.grounds(venueId).queryKey;
              queryClient.setQueryData(key, (list) => list?.filter((g) => g.id !== ground.id));
              const result = await send(
                api.DELETE("/v1/staff/venues/{venueId}/grounds/{groundId}", {
                  params: { path: { venueId, groundId: ground.id } },
                }),
              );
              if (!result.ok) hud.show(hudMessage(result.error));
              // Either way, the list, the checklist and the draft card read the server again.
              void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
            })();
          },
        },
      ],
    );
  };

  return (
    <StepScreen
      title={t("screens.setup.grounds.title")}
      subtitle={t("screens.setup.grounds.subtitle")}
      footer={<Button label={t("screens.setup.grounds.done")} onPress={() => router.back()} />}
    >
      {/* Edge to edge, like an iOS list: the lines and the swipe run to the screen's sides, and only
          the rows' contents keep the gutter. */}
      <View className="-mx-5 border-t border-border">
        {grounds.map((ground) => (
          <Row
            key={ground.id}
            ground={ground}
            price={t("screens.setup.grounds.price", {
              currency,
              amount: formatAmount(ground.basePrice, decimals),
            })}
            onPress={() => tap(ground)}
            onOpen={opened}
            onDelete={(row) => remove(ground, row)}
          />
        ))}
      </View>
      {grounds.length < MAXIMUM_GROUNDS ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/setup/${venueId}/grounds/new`)}
          className="flex-row items-center gap-2 self-start py-[18px] active:opacity-60"
        >
          <IconPlus size={24} color={colors.primary} strokeWidth={1.75} />
          <Text className="text-subtitle font-medium text-primary">
            {t("screens.setup.grounds.add")}
          </Text>
        </Pressable>
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
  const swipe = useRef<SwipeableMethods>(null);
  const name = ground.name ?? t("screens.setup.grounds.unnamed");
  const line = groundLine(t, ground);
  const perHour = t("screens.setup.grounds.perHour");
  const deleteLabel = t("screens.setup.grounds.delete");
  return (
    <ReanimatedSwipeable
      ref={swipe}
      // Follows the finger one to one, as iOS's rows do, and stops at the button's width.
      friction={1}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => onOpen(swipe.current)}
      // The platform's red, with a bin: the one place the staff app uses red outside errors, because
      // a swipe action that isn't red doesn't read as iOS's Delete.
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={() => onDelete(swipe.current)}
          className="w-20 items-center justify-center bg-red"
        >
          <IconTrash size={24} color={colors.white} strokeWidth={1.75} />
        </Pressable>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${line}, ${price}${perHour}`}
        // VoiceOver can't swipe a row open, so Delete is one of its actions instead.
        accessibilityActions={[{ name: "delete", label: deleteLabel }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "delete") onDelete(null);
        }}
        onPress={onPress}
        // Pressed shows as a grey highlight, never as fading: a see-through row would show the red
        // button behind it the moment a swipe begins. The short delay keeps a swipe from lighting
        // the row up at all.
        unstable_pressDelay={90}
        style={({ pressed }) => ({ backgroundColor: pressed ? colors.chip : colors.white })}
        className="flex-row items-center gap-3 border-b border-border px-5 py-[15px]"
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
      </Pressable>
    </ReanimatedSwipeable>
  );
}
