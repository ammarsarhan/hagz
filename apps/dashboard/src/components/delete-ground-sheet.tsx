import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";
import type { components } from "@hagz/api";
import { datesLabel } from "@/lib/regulars";
import { Button } from "./button";
import { Sheet } from "./sheet";
import { StepRail, type Step } from "./step-rail";
import { Text } from "./text";

type Removal = components["schemas"]["GroundRemoval"];

// Deleting a ground, asked first (user, 2026-11-27): a sheet with what follows on the step rail, as
// a regular's Pause and End: players stop seeing it, its waiting requests are declined, its bookings still to come go ahead and keep
// it on the calendar marked Deleted, each regular lets its waiting weeks go and ends after its last
// confirmed one, then it's gone. Cancel and Delete side
// by side under it (no bar; user, 2026-11-27); Delete asks once more, natively and briefly, before anything happens.
export function DeleteGroundSheet({
  name,
  removal,
  visible,
  onClose,
  onHidden,
  onDelete,
}: {
  name: string;
  removal: Removal;
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  // Confirmed in the alert: close the sheet and delete.
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const d = "screens.setup.grounds.deleteSheet";
  const { bookings, requests, regulars } = removal;

  const steps: Step[] = [
    {
      label: t(`${d}.hidden`),
      detail: t(`${d}.hiddenBody`),
      when: "",
      state: "now",
    },
    ...(requests > 0
      ? [
          {
            label: t(`${d}.requests`, { count: requests }),
            detail: t(`${d}.requestsBody`),
            when: "",
            state: "now" as const,
          },
        ]
      : []),
    ...(bookings > 0
      ? [
          {
            label: t(`${d}.ahead`, { count: bookings }),
            detail: t(`${d}.aheadBody`),
            when: "",
            state: "now" as const,
          },
        ]
      : []),
    // Each regular on it, as when hours close (user, 2026-11-27): its waiting weeks go, and it
    // ends after its last confirmed week, or now with none.
    ...regulars.map((regular): Step => ({
      label: regular.lastWeek
        ? t(`${d}.regularEnds`, { name: regular.name, date: datesLabel(t, [regular.lastWeek]) })
        : t(`${d}.regularEndsNow`, { name: regular.name }),
      detail: regular.lastWeek ? t(`${d}.regularBody`) : t(`${d}.regularBodyNone`),
      when: "",
      state: "now",
    })),
    {
      label: bookings > 0 ? t(`${d}.goneLater`) : t(`${d}.goneNow`),
      detail: t(`${d}.goneBody`),
      when: "",
      state: "next",
    },
  ];

  const ask = () =>
    Alert.alert(t(`${d}.alertTitle`, { name }), t(`${d}.alertBody`), [
      { text: t("screens.setup.grounds.cancel"), style: "cancel" },
      { text: t("screens.setup.grounds.deleteConfirm"), style: "destructive", onPress: onDelete },
    ]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-6 text-[22px] font-semibold leading-[1.27]">
        {t(`${d}.title`, { name })}
      </Text>
      <StepRail gap={22} steps={steps} />
      <View className="mt-8 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t("screens.setup.grounds.cancel")}
            variant="secondary"
            compact
            onPress={onClose}
          />
        </View>
        <View className="flex-1">
          <Button label={t(`${d}.button`)} compact onPress={ask} />
        </View>
      </View>
    </Sheet>
  );
}
