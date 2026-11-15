import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SetupLoading } from "@/components/setup-loading";
import { GroundFlowProvider, type GroundDraft } from "@/lib/ground-flow";
import type { Ground } from "@/lib/grounds";
import { amountOf, decimalsOf } from "@/lib/money";
import { queries } from "@/lib/queries";

// Adding a ground (`new`) or editing one (its id): four screens in a stack of their own, sharing one
// draft that's sent from the last (lib/ground-flow.tsx). The list pushes this whole stack, so
// finishing pops all four at once.
export default function GroundFlowLayout() {
  const { venueId = "", groundId = "new" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const venue = useQuery(queries.venue(venueId));
  const grounds = useQuery(queries.grounds(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  if (!grounds.data) return <SetupLoading query={grounds} />;
  return (
    <GroundFlow
      venueId={venueId}
      currency={venue.data.marketplace.currency}
      grounds={grounds.data}
      ground={grounds.data.find((g) => g.id === groundId) ?? null}
    />
  );
}

function GroundFlow({
  venueId,
  currency,
  grounds,
  ground,
}: {
  venueId: string;
  currency: string;
  grounds: Ground[];
  ground: Ground | null;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const decimals = decimalsOf(currency);
  // Seeded once, from the data as it was on arrival: a refetch behind the screens mustn't reset
  // what's being typed.
  const [initial] = useState<GroundDraft>(() =>
    ground
      ? {
          name: ground.name ?? "",
          sport: ground.sport,
          size: ground.size,
          surface: ground.surface,
          environment: ground.environment,
          basePrice: amountOf(ground.basePrice, decimals),
          peakPrice: ground.peakPrice === null ? "" : amountOf(ground.peakPrice, decimals),
          discountPrice:
            ground.discountPrice === null ? "" : amountOf(ground.discountPrice, decimals),
          minimumSlots: ground.minimumSlots,
          maximumSlots: ground.maximumSlots,
        }
      : {
          // "Pitch 5" after four: the next number no ground is already called by.
          name: nextName(grounds, (number) => t("screens.setup.grounds.defaultName", { number })),
          sport: "FOOTBALL",
          size: "FIVE_A_SIDE",
          surface: "ARTIFICIAL_TURF",
          environment: "OUTDOOR",
          basePrice: "",
          peakPrice: "",
          discountPrice: "",
          minimumSlots: 1,
          maximumSlots: 3,
        },
  );

  return (
    <GroundFlowProvider
      venueId={venueId}
      ground={ground}
      initial={initial}
      currency={currency}
      decimals={decimals}
      finish={() => navigation.goBack()}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </GroundFlowProvider>
  );
}

const nextName = (grounds: Ground[], name: (number: number) => string) => {
  const taken = new Set(grounds.map((g) => g.name));
  let number = grounds.length + 1;
  while (taken.has(name(number))) number += 1;
  return name(number);
};
