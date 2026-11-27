import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { SetupLoading } from "@/components/setup-loading";
import { CancellationFlowProvider } from "@/lib/cancellation-flow";
import { queries } from "@/lib/queries";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Choosing a cancellation policy: pick → your own rules (Custom only) → confirm, in a stack of its
// own sharing one draft (lib/cancellation-flow.tsx). The settings list pushes this whole stack, so
// saving pops all of it at once.
function CancellationLayout() {
  const { t } = useTranslation();
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const navigation = useNavigation();
  const venue = useQuery(queries.venue(venueId));
  // The confirm screen names the venue; the checklist has already fetched it.
  const setup = useQuery(queries.setup(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  return (
    <CancellationFlowProvider
      venue={venue.data}
      venueName={setup.data?.venue.name ?? t("screens.setup.untitled")}
      finish={() => navigation.goBack()}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </CancellationFlowProvider>
  );
}

export default guarded(RULES.venueForm, CancellationLayout);
