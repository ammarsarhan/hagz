import { DEFAULT_INVITATION_PERMISSIONS } from "@hagz/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessEditor } from "@/components/access-editor";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { useCurrentVenue } from "@/lib/current-venue";
import { isCompletePhone, toE164 } from "@/lib/phone";
import { above, AREAS, afterTeamWrite, type Permissions } from "@/lib/team";

// Inviting someone (Figma D20 726:245), from Team's +: their number, then their access, starting
// from what the venue gives new staff (and, for a manager who isn't the owner, never more than
// they have). Sent on WhatsApp; the link works for 48 hours. Send stays grey until the number is
// whole.
export default function Invite() {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const owner = venue?.role === "OWNER";
  const mine = venue?.permissions;
  const compact = useCompactTitle();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>(() => {
    if (owner || !mine) return DEFAULT_INVITATION_PERMISSIONS;
    // Lowered to what this manager may give.
    return Object.fromEntries(
      AREAS.map((area) => {
        const level = DEFAULT_INVITATION_PERMISSIONS[area];
        return [area, above(level, mine[area]) ? mine[area] : level];
      }),
    ) as Permissions;
  });
  const title = t("screens.team.invite.title");

  const sendInvite = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/invitations", {
        params: { path: { venueId } },
        body: { phone: toE164(phone), permissions },
      }),
    );
    setSending(false);
    if (!result.ok) {
      const code = problem(result.error)?.code;
      if (code === "INVALID_PHONE_NUMBER" || code === "ALREADY_A_MEMBER")
        setPhoneError(fieldMessage(result.error));
      else hud.show(hudMessage(result.error));
      return;
    }
    await afterTeamWrite(queryClient, venueId);
    router.back();
  };

  return (
    <Screen
      footer={
        <BottomBar
          title={t("screens.team.invite.barTitle")}
          detail={t("screens.team.invite.barBody")}
        >
          <BarButton
            label={t("screens.team.invite.send")}
            primary
            busy={sending}
            incomplete={!isCompletePhone(phone)}
            onPress={() => void sendInvite()}
          />
        </BottomBar>
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title small onTitleLayout={compact.onTitleLayout} subtitle={t("screens.team.invite.body")}>
          {title}
        </Title>
        <PhoneField
          label={t("screens.team.invite.phone")}
          value={phone}
          onChangeText={(digits) => {
            setPhone(digits);
            setPhoneError(undefined);
          }}
          error={phoneError}
        />
        <AccessEditor
          first
          hint={t("screens.team.invite.accessBody")}
          permissions={permissions}
          onChange={(area, level) => {
            if (!owner && mine && above(level, mine[area])) {
              hud.show(t("screens.team.aboveYourOwn"));
              return;
            }
            setPermissions((current) => ({ ...current, [area]: level }));
          }}
        />
      </FadingScroll>
    </Screen>
  );
}
