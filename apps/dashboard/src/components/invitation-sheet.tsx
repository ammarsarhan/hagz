import type { components } from "@hagz/api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { displayPhone, isolate } from "@/lib/phone";
import { AccessList } from "./access-list";
import { Button } from "./button";
import { CodeInput } from "./code-input";
import { useHud } from "./hud";
import type { ReceivedInvitation } from "./invitation-card";
import { Sheet } from "./sheet";
import { Text } from "./text";

type StaffVenue = components["schemas"]["StaffVenue"];

// One sheet for joining a venue, whose content changes in place rather than stacking sheets:
// typing a code (from "Have a code?"), the invitation itself with what it grants, or why it can't be
// accepted (it ended, they're already on the team, or a link sent to another number).
type Step =
  | { kind: "code" }
  | { kind: "opening"; code: string }
  | { kind: "elsewhere"; code: string }
  | { kind: "offer"; invitation: ReceivedInvitation; code?: string }
  | { kind: "ended"; invitedBy?: string }
  | { kind: "member"; venue: string };

const CODE_LENGTH = 6;

export type SheetStart = ReceivedInvitation | "code" | { link: string };

export function InvitationSheet({
  start,
  phone,
  visible,
  onHidden,
  onClose,
  onJoined,
  onDeclined,
  onSwitchNumber,
  onOutdated,
}: {
  // An invitation from the list, "code" to start by typing one, or the code from a link.
  start: SheetStart;
  // The signed-in number, without +20, for "sent to …".
  phone: string;
  // Closing: set to false, and unmount on onHidden (after the slide down).
  visible: boolean;
  onHidden: () => void;
  onClose: () => void;
  onJoined: (venue: StaffVenue) => void;
  onDeclined: (invitationId: string) => void;
  // "Sign in with another number", for a link sent to a different one.
  onSwitchNumber: (code: string) => void;
  // It turned out the list is out of date: the invitation ended, or they're already on the team.
  onOutdated: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const [step, setStep] = useState<Step>(() =>
    start === "code"
      ? { kind: "code" }
      : "link" in start
        ? { kind: "opening", code: start.link }
        : { kind: "offer", invitation: start },
  );
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState<"look-up" | "join" | "decline" | null>(null);

  // A failure that says why the invitation can't be taken, shown in the sheet; anything else is a HUD.
  const showReason = (error: unknown, invitation?: ReceivedInvitation) => {
    const details = problem(error);
    const failure = details?.code;
    if (failure === "INVITATION_EXPIRED") {
      onOutdated();
      setStep({ kind: "ended", invitedBy: invitation?.invitedBy });
    } else if (failure === "ALREADY_A_MEMBER") {
      // The API names the venue, which a link doesn't otherwise have.
      const venue = (details?.venue as { name?: string | null } | undefined)?.name;
      onOutdated();
      setStep({ kind: "member", venue: venue ?? invitation?.venue.name ?? "" });
    } else {
      hud.show(hudMessage(error));
    }
  };

  const lookUp = async (value: string) => {
    setBusy("look-up");
    const result = await send(
      api.GET("/v1/staff/invitations/code/{code}", { params: { path: { code: value } } }),
    );
    setBusy(null);
    if (result.ok) {
      setStep({ kind: "offer", invitation: result.data, code: value });
      return;
    }
    const failure = problem(result.error)?.code;
    if (failure === "INVITATION_NOT_FOUND") setCodeError(t("screens.haveCode.wrong"));
    else if (failure === "RATE_LIMITED") {
      setLocked(true);
      setCodeError(fieldMessage(result.error));
    } else showReason(result.error);
  };

  // A link's code is exact, so "not found" means it was sent to another number: the API answers
  // the same for both on purpose, so codes can't be probed. Anything else unexpected closes the sheet
  // behind a HUD, since there's nothing here to retry with.
  const openLink = async (value: string) => {
    const result = await send(
      api.GET("/v1/staff/invitations/code/{code}", { params: { path: { code: value } } }),
    );
    if (result.ok) {
      setStep({ kind: "offer", invitation: result.data, code: value });
      return;
    }
    const failure = problem(result.error)?.code;
    if (failure === "INVITATION_NOT_FOUND") setStep({ kind: "elsewhere", code: value });
    else if (failure === "INVITATION_EXPIRED" || failure === "ALREADY_A_MEMBER") {
      showReason(result.error);
    } else {
      hud.show(hudMessage(result.error));
      onClose();
    }
  };

  // Once, when the sheet opens on a link.
  useEffect(() => {
    if (step.kind === "opening") void openLink(step.code);
  }, []);

  const join = async (invitation: ReceivedInvitation, byCode?: string) => {
    setBusy("join");
    const result = await send(
      byCode
        ? api.POST("/v1/staff/invitations/code/{code}/accept", {
            params: { path: { code: byCode } },
          })
        : api.POST("/v1/staff/invitations/{invitationId}/accept", {
            params: { path: { invitationId: invitation.id } },
          }),
    );
    setBusy(null);
    if (result.ok) onJoined(result.data);
    else showReason(result.error, invitation);
  };

  const decline = async (invitation: ReceivedInvitation) => {
    setBusy("decline");
    const result = await send(
      api.POST("/v1/staff/invitations/{invitationId}/decline", {
        params: { path: { invitationId: invitation.id } },
      }),
    );
    setBusy(null);
    if (result.ok) onDeclined(invitation.id);
    else hud.show(hudMessage(result.error));
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      {step.kind === "code" ? (
        <>
          <Heading
            title={t("screens.haveCode.title")}
            subtitle={t("screens.haveCode.subtitle", { phone: isolate(displayPhone(phone)) })}
          />
          <CodeInput
            kind="code"
            value={code}
            onChangeText={(next) => {
              setCode(next);
              setCodeError(undefined);
              if (next.length === CODE_LENGTH) void lookUp(next);
            }}
            error={codeError}
            disabled={locked}
          />
          <View className="mt-1">
            <Button
              label={t("common.actions.continue")}
              disabled={code.length < CODE_LENGTH || Boolean(codeError) || locked}
              loading={busy === "look-up"}
              onPress={() => void lookUp(code)}
            />
          </View>
        </>
      ) : null}

      {step.kind === "opening" ? (
        <>
          <Heading
            title={t("screens.invitation.opening.title")}
            subtitle={t("screens.invitation.opening.body", {
              phone: isolate(displayPhone(phone)),
            })}
          />
          <Button label={t("screens.invitation.opening.title")} loading onPress={() => undefined} />
        </>
      ) : null}

      {step.kind === "elsewhere" ? (
        <>
          <Heading
            title={t("screens.invitation.elsewhere.title")}
            subtitle={t("screens.invitation.elsewhere.body", {
              phone: isolate(displayPhone(phone)),
            })}
          />
          <View className="gap-2.5">
            <Button label={t("screens.invitation.elsewhere.gotIt")} onPress={onClose} />
            <Button
              label={t("screens.invitation.elsewhere.switch")}
              variant="ghost"
              onPress={() => onSwitchNumber(step.code)}
            />
          </View>
        </>
      ) : null}

      {step.kind === "offer" ? (
        <>
          <Heading
            title={t("screens.invitation.title", { venue: step.invitation.venue.name ?? "" })}
            subtitle={t("screens.invitation.subtitle", { name: step.invitation.invitedBy })}
          />
          <AccessList permissions={step.invitation.permissions} />
          <View className="mt-12 gap-2.5">
            <Button
              label={t("screens.invitation.join")}
              loading={busy === "join"}
              disabled={busy !== null}
              onPress={() => void join(step.invitation, step.code)}
            />
            <Button
              label={t("screens.invitation.decline")}
              variant="ghost"
              loading={busy === "decline"}
              disabled={busy !== null}
              onPress={() => void decline(step.invitation)}
            />
          </View>
        </>
      ) : null}

      {step.kind === "ended" ? (
        <>
          <Heading
            title={t("screens.invitation.ended.title")}
            subtitle={
              step.invitedBy
                ? t("screens.invitation.ended.body", { name: step.invitedBy })
                : t("screens.invitation.ended.bodyNoName")
            }
          />
          <Button label={t("screens.invitation.ended.gotIt")} onPress={onClose} />
        </>
      ) : null}

      {step.kind === "member" ? (
        <>
          <Heading
            title={t("screens.invitation.member.title")}
            subtitle={t("screens.invitation.member.body", { venue: step.venue })}
          />
          <Button
            label={t("screens.invitation.member.open", { venue: step.venue })}
            onPress={onClose}
          />
        </>
      ) : null}
    </Sheet>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <Text className="mb-1.5 text-heading font-semibold">{title}</Text>
      <Text className="mb-[22px] text-subtitle text-ink-2">{subtitle}</Text>
    </>
  );
}
