import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, I18nManager, useWindowDimensions, View } from "react-native";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { isRTL } from "@/lib/language";
import { displayPhone, isolate } from "@/lib/phone";
import { useHud } from "./hud";
import { InfoRows } from "./info-rows";
import { InvitationCard, type ReceivedInvitation } from "./invitation-card";
import { StartTiles } from "./start-tiles";
import { Text } from "./text";

// The carousel runs left to right; in Arabic it's flipped so the next card comes from the left, as
// onboarding's pager does. Builds that are natively right-to-left already scroll that way.
const flipRail = isRTL && !I18nManager.isRTL;
const GUTTER = 20;
const CARD_GAP = 10;
// How much of the next card shows at the edge, so the row reads as more to swipe.
const PEEK = 32;

// The ways onto a venue's team, as first run shows them (Figma "D2 · First run, carousel option"):
// the invitations waiting as a row of blue cards, then "Create your venue" and "Have a code?". With
// none waiting, the tiles come first and a line says how to get invited. Shared by first run and the
// Account tab's "Join or create a venue", so the two stay the same.
export function StartOptions({
  invitations,
  phone,
  onOpen,
  onHaveCode,
  onDeclined,
}: {
  invitations: ReceivedInvitation[];
  // The signed-in number, without +20.
  phone: string;
  onOpen: (invitation: ReceivedInvitation) => void;
  onHaveCode: () => void;
  onDeclined: (invitationId: string) => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const [declining, setDeclining] = useState<string | null>(null);
  const invited = invitations.length > 0;

  // From the card: declining is final and needs no detail, so it doesn't go through the sheet.
  const decline = async (received: ReceivedInvitation) => {
    setDeclining(received.id);
    const result = await send(
      api.POST("/v1/staff/invitations/{invitationId}/decline", {
        params: { path: { invitationId: received.id } },
      }),
    );
    setDeclining(null);
    if (result.ok) onDeclined(received.id);
    else hud.show(hudMessage(result.error));
  };

  const startTiles = (
    <StartTiles onCreateVenue={() => router.push("/create-venue")} onHaveCode={onHaveCode} />
  );

  if (!invited) {
    return (
      <>
        {startTiles}
        <View className="mt-[22px]">
          <InfoRows
            rows={[
              {
                title: t("screens.firstRun.joiningTitle"),
                body: t("screens.firstRun.joiningBody", { phone: isolate(displayPhone(phone)) }),
              },
            ]}
          />
        </View>
      </>
    );
  }

  return (
    <>
      {invitations.length > 1 ? (
        <SectionLabel>
          {t("screens.firstRun.invitations", { count: invitations.length })}
        </SectionLabel>
      ) : null}
      <Invitations
        invitations={invitations}
        declining={declining}
        onOpen={onOpen}
        onDecline={(received) => void decline(received)}
      />
      <View className="mt-[22px]">
        <SectionLabel>{t("screens.firstRun.moreWays")}</SectionLabel>
      </View>
      {startTiles}
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text className="mb-2.5 text-label font-medium text-ink-2">{children}</Text>;
}

// One invitation fills the row. More become a carousel that runs to the screen edges: each card is
// narrower than the gutters so the next one peeks in, and a swipe snaps the next card to the gutter.
function Invitations({
  invitations,
  declining,
  onOpen,
  onDecline,
}: {
  invitations: ReceivedInvitation[];
  declining: string | null;
  onOpen: (invitation: ReceivedInvitation) => void;
  onDecline: (invitation: ReceivedInvitation) => void;
}) {
  const { width } = useWindowDimensions();
  const card = (invitation: ReceivedInvitation, cardWidth?: number) => (
    <InvitationCard
      invitation={invitation}
      width={cardWidth}
      declining={declining === invitation.id}
      onOpen={() => onOpen(invitation)}
      onDecline={() => onDecline(invitation)}
    />
  );

  const [only] = invitations;
  if (invitations.length === 1 && only) return card(only);

  const cardWidth = width - GUTTER * 2 - PEEK;
  return (
    <FlatList
      data={invitations}
      keyExtractor={(invitation) => invitation.id}
      horizontal
      inverted={flipRail}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + CARD_GAP}
      decelerationRate="fast"
      disableIntervalMomentum
      style={{ marginHorizontal: -GUTTER, direction: "ltr", flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: CARD_GAP }}
      renderItem={({ item }) => (
        <View style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>{card(item, cardWidth)}</View>
      )}
    />
  );
}
