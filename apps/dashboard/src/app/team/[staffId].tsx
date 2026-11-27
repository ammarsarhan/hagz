import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessEditor } from "@/components/access-editor";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SettingsHeading, SettingsRow } from "@/components/settings-row";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { useCurrentVenue } from "@/lib/current-venue";
import { queries } from "@/lib/queries";
import {
  above,
  AREAS,
  afterTeamWrite,
  memberPhone,
  membersQuery,
  type Member,
  type Permissions,
} from "@/lib/team";

// A member's access (Figma D20 726:109 and, after a password reset, 726:382): the seven areas with
// None / View / Manage each. Save waits in a bar that says what changed, grey until something has.
// A member a reset cut back to View shows when, with Give back in the bar while nothing's been
// changed since. Your own access and the owner's are shown, not changed; and only the owner can
// give more in an area than they have themselves.
export default function TeamMember() {
  const { t } = useTranslation();
  const { staffId = "" } = useLocalSearchParams<{ staffId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const members = useQuery(membersQuery(venueId));
  const me = useQuery(queries.me).data;
  const member = members.data?.find((one) => one.staffId === staffId);
  const compact = useCompactTitle();

  return member && venue ? (
    <Editor
      // Saved or given back: the screen starts again from what's saved now.
      key={JSON.stringify(member.permissions)}
      member={member}
      venueId={venueId}
      mine={venue.permissions}
      owner={venue.role === "OWNER"}
      editable={
        venue.permissions.staff === "manage" && member.role !== "OWNER" && member.staffId !== me?.id
      }
      compact={compact}
    />
  ) : (
    <Screen>
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
    </Screen>
  );
}

function Editor({
  member,
  venueId,
  mine,
  owner,
  editable,
  compact,
}: {
  member: Member;
  venueId: string;
  mine: Permissions;
  owner: boolean;
  editable: boolean;
  compact: ReturnType<typeof useCompactTitle>;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Permissions>(member.permissions);
  const [saving, setSaving] = useState(false);
  const changed = AREAS.filter((area) => draft[area] !== member.permissions[area]);
  const level = (value: Permissions[keyof Permissions]) => t(`screens.team.levels.${value}`);

  const done = async (permissions: Permissions) => {
    queryClient.setQueryData<Member[]>(membersQuery(venueId).queryKey, (current) =>
      current?.map((one) =>
        one.staffId === member.staffId ? { ...one, permissions, restorable: false } : one,
      ),
    );
    await afterTeamWrite(queryClient, venueId);
  };

  const save = async () => {
    setSaving(true);
    const result = await send(
      api.PUT("/v1/staff/venues/{venueId}/members/{staffId}/permissions", {
        params: { path: { venueId, staffId: member.staffId } },
        body: draft,
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    await done(result.data);
  };

  const giveBack = async () => {
    setSaving(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/members/{staffId}/permissions/restore", {
        params: { path: { venueId, staffId: member.staffId } },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      void afterTeamWrite(queryClient, venueId);
      return;
    }
    await done(result.data);
  };

  const footer =
    changed.length > 0 ? (
      <BottomBar
        title={t("screens.team.changes", { count: changed.length })}
        detail={changed
          .map((area) =>
            t("screens.team.change", {
              area: t(`screens.team.areas.${area}`),
              from: level(member.permissions[area]),
              to: level(draft[area]),
            }),
          )
          .join(t("screens.team.comma"))}
      >
        <BarButton
          label={t("screens.team.save")}
          primary
          busy={saving}
          onPress={() => void save()}
        />
      </BottomBar>
    ) : editable && member.restorable ? (
      <BottomBar
        title={t("screens.team.giveBack.title")}
        detail={t("screens.team.giveBack.body", { name: member.name })}
      >
        <BarButton
          label={t("screens.team.giveBack.button")}
          primary
          busy={saving}
          onPress={() => void giveBack()}
        />
      </BottomBar>
    ) : null;

  return (
    <Screen footer={footer ?? undefined}>
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={member.name}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={member.phone ? memberPhone(member.phone) : undefined}
        >
          {member.name}
        </Title>

        {member.restorable ? (
          <>
            <SettingsHeading tight>{t("screens.team.cutHeading")}</SettingsHeading>
            <SettingsRow
              title={t("screens.team.cutTitle", { name: member.name })}
              body={t("screens.team.cutBody")}
              divider={false}
            />
          </>
        ) : null}

        <SettingsHeading tight={!member.restorable}>{t("screens.team.access")}</SettingsHeading>
        <AccessEditor
          permissions={draft}
          onChange={
            editable
              ? (area, value) => {
                  // The API refuses it too; said here before anything is sent.
                  if (!owner && above(value, mine[area])) {
                    hud.show(t("screens.team.aboveYourOwn"));
                    return;
                  }
                  setDraft((current) => ({ ...current, [area]: value }));
                }
              : undefined
          }
        />
      </FadingScroll>
    </Screen>
  );
}
