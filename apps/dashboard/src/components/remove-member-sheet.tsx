import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { afterTeamWrite } from "@/lib/team";
import { Button } from "./button";
import { useHud } from "./hud";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Taking someone off the team, asked first (user, 2026-11-27). Their access ends at once; their
// account, and the bookings they made, stay. Done, the sheet slides away and the page goes back to
// Team, which no longer lists them. The button is black, as Sign out's is: it ends something.
export function RemoveMemberSheet({
  venueId,
  staffId,
  name,
  visible,
  onClose,
}: {
  venueId: string;
  staffId: string;
  name: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  // Removed: back to Team once the sheet has gone, then the list is read again.
  const removed = useRef(false);

  const run = async () => {
    setSending(true);
    const result = await send(
      api.DELETE("/v1/staff/venues/{venueId}/members/{staffId}", {
        params: { path: { venueId, staffId } },
      }),
    );
    setSending(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    removed.current = true;
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        if (!removed.current) return;
        router.back();
        void afterTeamWrite(queryClient, venueId);
      }}
      closeLabel={t("components.shared.nav.close")}
      footer={
        <View className="mt-8">
          <Button
            label={t("screens.team.remove.button")}
            variant="ink"
            loading={sending}
            onPress={() => void run()}
          />
        </View>
      }
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.team.remove.title", { name })}
      </Text>
      <Text className="mt-2 text-body text-ink-2">{t("screens.team.remove.body", { name })}</Text>
    </Sheet>
  );
}
