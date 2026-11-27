import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { HeaderButton } from "@/components/header-button";
import { useHud } from "@/components/hud";
import { IconBell, IconScan } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { colors } from "@/lib/colors";
import { queries } from "@/lib/queries";

// The venue's Home tab (user, 2026-11-27: built up from its header). The title, then the Calendar's
// round buttons on the same row: scanning a player's code, and notifications. Neither screen is
// built yet. An invitation link opened while on a venue's team opens here, in the same sheet as on
// first run.
export default function VenueHome() {
  const { t } = useTranslation();
  const hud = useHud();
  const me = useQuery(queries.me);
  const invitation = useInvitationSheet({
    phone: me.data?.phone.replace(/^\+20/, ""),
    takeLinks: me.data !== undefined,
  });
  const comingNext = () => hud.show(t("common.comingNext"));

  return (
    <Screen tabbed>
      {/* The Calendar's header: its 13 pt under the status bar, the title beside its buttons. */}
      <View className="mt-[13px] h-10 flex-row items-center">
        <Text
          accessibilityRole="header"
          className="flex-1 text-title font-semibold tracking-[-0.4px]"
          numberOfLines={1}
        >
          {t("screens.home.title")}
        </Text>
        <HeaderButton label={t("screens.home.scan")} onPress={comingNext}>
          <IconScan size={20} color={colors.ink} strokeWidth={1.75} />
        </HeaderButton>
        <View className="ms-2">
          <HeaderButton label={t("screens.home.notifications")} onPress={comingNext}>
            <IconBell size={20} color={colors.ink} strokeWidth={1.75} />
          </HeaderButton>
        </View>
      </View>
      {invitation.sheet}
    </Screen>
  );
}
