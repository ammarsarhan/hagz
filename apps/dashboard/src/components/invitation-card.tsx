import type { components } from "@hagz/api";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Text } from "./text";

export type ReceivedInvitation = components["schemas"]["ReceivedStaffInvitation"];

// Soft tints for the team's initials, by position.
const TINTS = ["#e3e8fd", "#fde8d7", "#ddf3e4"];

export const hoursLeft = (expiresAt: string) =>
  Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));

// An invitation on the first-run screen, as approved in Figma: grounds, venue name and address on
// top; a dashed rule; who invited you and when it runs out, and the team (two faces, then +N).
export function InvitationCard({
  invitation,
  onPress,
}: {
  invitation: ReceivedInvitation;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { venue } = invitation;
  const hours = hoursLeft(invitation.expiresAt);
  const extra = venue.team.size - venue.team.initials.length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 rounded-card border border-border bg-white active:opacity-70"
    >
      <View className="px-5 pb-5 pt-6">
        <Text className="mb-2 text-caption font-medium text-unit">
          {t("components.invitationCard.grounds", { count: venue.groundCount })}
        </Text>
        <Text className="mb-1 text-[20px] font-semibold leading-[1.3]">{venue.name ?? ""}</Text>
        {venue.address ? <Text className="text-body text-ink-2">{venue.address}</Text> : null}
      </View>
      <View className="mx-5 border-t border-dashed border-[#d9dbdf]" />
      <View className="flex-row items-center justify-between gap-3 px-5 pb-6 pt-5">
        <Text className="flex-1 text-caption text-unit">
          {t("components.invitationCard.invitedBy", { name: invitation.invitedBy })}
          {"\n"}
          {hours > 0
            ? t("components.invitationCard.expiresIn", { count: hours })
            : t("components.invitationCard.expiresSoon")}
        </Text>
        <View className="flex-row" style={{ direction: "ltr" }}>
          {venue.team.initials.map((initials, i) => (
            <Face
              key={`${initials}-${i}`}
              label={initials}
              tint={TINTS[i % TINTS.length]}
              first={i === 0}
            />
          ))}
          {extra > 0 ? <Face label={`+${extra}`} tint="#f2f3f5" muted first={false} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Face({
  label,
  tint,
  muted = false,
  first,
}: {
  label: string;
  tint?: string;
  muted?: boolean;
  first: boolean;
}) {
  return (
    <View
      className={`size-7 items-center justify-center rounded-full ${first ? "" : "-ms-[5px]"}`}
      style={{ backgroundColor: tint, borderWidth: 2, borderColor: "#ffffff" }}
    >
      <Text className={`text-[10px] font-semibold ${muted ? "text-unit" : ""}`}>{label}</Text>
    </View>
  );
}
