import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { afterVenueWrite, queries } from "@/lib/queries";
import { BarButton, BottomBar } from "./bottom-bar";
import { useHud } from "./hud";
import { Sheet } from "./sheet";
import { StepRail, type Step } from "./step-rail";
import { Text } from "./text";

// Pausing or reopening a live venue from the Venue tab's switch (user, 2026-11-27): the switch keeps
// showing what's saved, and this sheet asks first, saying what follows on the step rail, the way a
// regular's Pause does. Paused, players can't book; the page stays up with a notice and bookings
// already made still happen. Reopening needs a ground in use (the API says so otherwise).
export function VenuePauseSheet({
  venueId,
  name,
  action,
  visible,
  onClose,
}: {
  venueId: string;
  name: string;
  action: "pause" | "resume";
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const s = `screens.venueTab.${action}` as const;

  const steps: Step[] =
    action === "pause"
      ? [
          {
            label: t("screens.venueTab.pause.stop"),
            detail: t("screens.venueTab.pause.stopBody"),
            when: "",
            state: "now",
          },
          {
            label: t("screens.venueTab.pause.stand"),
            detail: t("screens.venueTab.pause.standBody"),
            when: "",
            state: "done",
          },
          {
            label: t("screens.venueTab.pause.after"),
            detail: t("screens.venueTab.pause.afterBody"),
            when: "",
            state: "next",
          },
        ]
      : [
          {
            label: t("screens.venueTab.resume.open"),
            detail: t("screens.venueTab.resume.openBody"),
            when: "",
            state: "now",
          },
        ];

  const run = async () => {
    setSending(true);
    const path = { params: { path: { venueId } } };
    const result = await send(
      action === "pause"
        ? api.POST("/v1/staff/venues/{venueId}/pause", path)
        : api.POST("/v1/staff/venues/{venueId}/resume", path),
    );
    if (!result.ok) {
      setSending(false);
      hud.show(hudMessage(result.error));
      return;
    }
    // The switch follows the venue's status, so it moves once this is read again.
    await afterVenueWrite(queryClient, venueId, {
      checklist: false,
      also: [queries.venue(venueId).queryKey],
    });
    setSending(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      closeLabel={t("components.shared.nav.close")}
      scrollable
      footer={
        <View className="mt-8 pt-3">
          <BottomBar title={t(`${s}.barTitle`)} detail={t(`${s}.barBody`)}>
            <BarButton label={t(`${s}.button`)} primary busy={sending} onPress={() => void run()} />
          </BottomBar>
        </View>
      }
    >
      <Text accessibilityRole="header" className="mb-6 text-[22px] font-semibold leading-[1.27]">
        {t(`${s}.title`, { name })}
      </Text>
      <StepRail gap={22} steps={steps} />
    </Sheet>
  );
}
