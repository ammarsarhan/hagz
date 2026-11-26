import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";
import type { components } from "@hagz/api";
import { datesJoin } from "@/lib/regulars";
import { BarButton, BottomBar } from "./bottom-bar";
import { Sheet } from "./sheet";
import { StepRail, type Step } from "./step-rail";
import { Text } from "./text";

type Removal = components["schemas"]["GroundRemoval"];

// Deleting a ground, asked first (user, 2026-11-27): a sheet with what follows on the step rail, as
// a regular's Pause and End: players stop seeing it, its bookings still to come go ahead and keep
// it on the calendar marked Deleted, its regulars end with it, then it's gone. Delete in the bar
// asks once more, natively and briefly, before anything happens.
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
  const { bookings, regulars } = removal;

  const steps: Step[] = [
    {
      label: t(`${d}.hidden`),
      detail: t(`${d}.hiddenBody`),
      when: "",
      state: "now",
      bold: "label",
    },
    ...(bookings > 0
      ? [
          {
            label: t(`${d}.ahead`, { count: bookings }),
            detail: t(`${d}.aheadBody`),
            when: "",
            state: "now" as const,
            bold: "label" as const,
          },
        ]
      : []),
    ...(regulars.length > 0
      ? [
          {
            label: t(`${d}.regulars`, { count: regulars.length, names: datesJoin(t, regulars) }),
            detail: t(`${d}.regularsBody`),
            when: "",
            state: "now" as const,
            bold: "label" as const,
          },
        ]
      : []),
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
      <View className="mt-8 pt-3">
        <BottomBar
          title={bookings > 0 ? t(`${d}.barTitle`, { count: bookings }) : t(`${d}.barTitlePlain`)}
          detail={t(`${d}.barBody`)}
        >
          <BarButton label={t(`${d}.button`)} primary onPress={ask} />
        </BottomBar>
      </View>
    </Sheet>
  );
}
