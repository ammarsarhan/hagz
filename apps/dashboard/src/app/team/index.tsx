import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconPhone, IconPlus } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SettingsHeading, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { isRTL } from "@/lib/language";
import { push } from "@/lib/navigation";
import { useNow } from "@/lib/use-now";
import {
  accessLine,
  afterTeamWrite,
  invitationsQuery,
  memberPhone,
  membersQuery,
  type Invitation,
} from "@/lib/team";

const HOUR = 3_600_000;

// The venue's team (Figma D20 726:3), from the Venue tab: the owner, then staff with what each can
// do in a line (and when a password reset cut it back), then invitations still waiting, each with
// when it runs out and Withdraw. + invites someone. Changing anything needs `staff: manage`.
export default function Team() {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const canManage = venue?.permissions.staff === "manage";
  const compact = useCompactTitle();
  const members = useQuery(membersQuery(venueId));
  const invited = useQuery(invitationsQuery(venueId));
  // "Expires in 31 h" counts down while the page is open.
  const now = useNow((at) => at + 60_000);
  const title = t("screens.team.title");

  const owners = members.data?.filter((member) => member.role === "OWNER") ?? [];
  const staff = members.data?.filter((member) => member.role !== "OWNER") ?? [];
  const waiting = invited.data ?? [];
  const chevron = (
    <IconChevronRight
      size={18}
      color={colors.unit}
      strokeWidth={2}
      style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );

  const withdraw = async (invitation: Invitation) => {
    const result = await send(
      api.DELETE("/v1/staff/venues/{venueId}/invitations/{invitationId}", {
        params: { path: { venueId, invitationId: invitation.id } },
      }),
    );
    if (!result.ok) hud.show(hudMessage(result.error));
    await afterTeamWrite(queryClient, venueId);
  };

  const expiry = (invitation: Invitation) => {
    const hours = Math.ceil((new Date(invitation.expiresAt).getTime() - now) / HOUR);
    return hours <= 1 ? t("screens.team.expiresSoon") : t("screens.team.expires", { count: hours });
  };

  return (
    <Screen>
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
        end={
          canManage ? (
            <RoundButton
              icon={IconPlus}
              label={t("screens.team.invite.title")}
              onPress={() => push("/team/invite")}
            />
          ) : undefined
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={
            members.data
              ? [
                  t("screens.team.people", { count: members.data.length }),
                  waiting.length > 0 ? t("screens.team.waiting", { count: waiting.length }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
        >
          {title}
        </Title>

        {members.isPending ? (
          <ActivityIndicator className="my-10" color={colors.ink3} />
        ) : members.isError ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.team.failed")}</Text>
        ) : (
          <>
            <SettingsHeading tight>{t("screens.team.owner")}</SettingsHeading>
            {owners.map((owner, index) => (
              <SettingsRow
                key={owner.staffId}
                leading={<Avatar name={owner.name} size="row" />}
                title={owner.name}
                body={t("screens.team.everything")}
                divider={index < owners.length - 1}
              />
            ))}

            {staff.length > 0 ? (
              <>
                <SettingsHeading>{t("screens.team.staff")}</SettingsHeading>
                {staff.map((member, index) => (
                  <SettingsRow
                    key={member.staffId}
                    leading={<Avatar name={member.name} size="row" />}
                    title={member.name}
                    body={[
                      member.restorable ? t("screens.team.cut") : accessLine(t, member.permissions),
                      member.status === "ACTIVE" ? null : t("screens.team.suspended"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={chevron}
                    onPress={() => push(`/team/${member.staffId}`)}
                    divider={index < staff.length - 1}
                  />
                ))}
              </>
            ) : null}

            {waiting.length > 0 ? (
              <>
                <SettingsHeading>{t("screens.team.invited")}</SettingsHeading>
                {waiting.map((invitation, index) => (
                  <SettingsRow
                    key={invitation.id}
                    leading={
                      <View className="size-10 items-center justify-center rounded-full bg-chip">
                        <IconPhone size={18} color={colors.ink} strokeWidth={1.75} />
                      </View>
                    }
                    title={memberPhone(invitation.phone)}
                    body={`${accessLine(t, invitation.permissions)} · ${expiry(invitation)}`}
                    trailing={
                      canManage ? (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => void withdraw(invitation)}
                          className="active:opacity-60"
                        >
                          <Text className="text-body font-medium underline">
                            {t("screens.team.withdraw")}
                          </Text>
                        </Pressable>
                      ) : undefined
                    }
                    divider={index < waiting.length - 1}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </FadingScroll>
    </Screen>
  );
}
