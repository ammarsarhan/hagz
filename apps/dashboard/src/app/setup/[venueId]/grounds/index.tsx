import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { MAXIMUM_GROUNDS } from "@hagz/contracts";
import { Button } from "@/components/button";
import { IconChevronRight, IconPlus } from "@/components/icons";
import { SetupLoading } from "@/components/setup-loading";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { groundLine, type Ground } from "@/lib/grounds";
import { isRTL } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { queries } from "@/lib/queries";

// Setup item "Grounds and prices" (Figma "Grounds · List", 351:2): every ground players can book,
// in order, each with what it is and its normal price per hour. Tapping one edits it; "Add a
// ground" walks through the four screens under [groundId]. Each ground is saved as it's added, so
// Done only leaves.
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
  const decimals = decimalsOf(currency);

  return (
    <StepScreen
      title={t("screens.setup.grounds.title")}
      subtitle={t("screens.setup.grounds.subtitle")}
      footer={<Button label={t("screens.setup.grounds.done")} onPress={() => router.back()} />}
    >
      <View className="border-t border-border">
        {grounds.map((ground) => (
          <Row
            key={ground.id}
            ground={ground}
            price={t("screens.setup.grounds.price", {
              currency,
              amount: formatAmount(ground.basePrice, decimals),
            })}
            onPress={() => router.push(`/setup/${venueId}/grounds/${ground.id}`)}
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

function Row({ ground, price, onPress }: { ground: Ground; price: string; onPress: () => void }) {
  const { t } = useTranslation();
  const name = ground.name ?? t("screens.setup.grounds.unnamed");
  const line = groundLine(t, ground);
  const perHour = t("screens.setup.grounds.perHour");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${line}, ${price}${perHour}`}
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border py-[15px] active:opacity-60"
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
  );
}
