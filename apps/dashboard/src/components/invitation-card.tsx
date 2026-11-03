import type { components } from "@hagz/api";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { artVariant, invitationArt } from "./invitation-art";
import { Text } from "./text";

export type ReceivedInvitation = components["schemas"]["ReceivedStaffInvitation"];

export const hoursLeft = (expiresAt: string) =>
  Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));

// An invitation on the first-run screen, as approved in Figma: the blue card with its decoration
// picked from the venue, who invited you, the venue, where it is and its size, Decline and Join, and
// when it runs out. Join (or the card itself) opens the invitation's sheet, which shows what joining
// grants before it's confirmed; Decline is final, so it acts straight away.
export function InvitationCard({
  invitation,
  width,
  declining = false,
  onOpen,
  onDecline,
}: {
  invitation: ReceivedInvitation;
  // Set in the carousel, where cards are narrower than the screen and grow to the tallest one;
  // otherwise it fills the row.
  width?: number;
  declining?: boolean;
  onOpen: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [countsWrapped, setCountsWrapped] = useState(false);
  const { venue } = invitation;
  const hours = hoursLeft(invitation.expiresAt);
  const counts = [
    t("components.invitationCard.grounds", { count: venue.groundCount }),
    t("components.invitationCard.staff", { count: venue.team.size }),
  ].join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      style={width ? { width, flexGrow: 1 } : undefined}
      className="overflow-hidden rounded-[18px] bg-primary"
    >
      {size ? (
        <SvgXml
          xml={invitationArt(artVariant(venue.id), size.width, size.height, isRTL)}
          width={size.width}
          height={size.height}
          style={{ position: "absolute" }}
        />
      ) : null}
      <View className="grow px-[18px] pb-4 pt-5">
        <Text className="mb-[5px] text-caption font-medium text-on-primary-muted">
          {t("components.invitationCard.invitedBy", { name: invitation.invitedBy })}
        </Text>
        <Text className="text-[20px] font-semibold leading-[1.3] text-white" numberOfLines={1}>
          {venue.name ?? ""}
        </Text>
        {/* The counts follow the address, or move to their own line when it needs the room. The dot
            between them stays laid out when they wrap, only hidden, so the wrap can't flip back. */}
        <View className="mt-[3px] flex-row flex-wrap">
          {venue.address ? (
            <Text className="text-body text-on-primary-muted">
              {venue.address}
              <Text
                className="text-body text-on-primary-muted"
                style={countsWrapped ? { color: "transparent" } : undefined}
              >
                {" · "}
              </Text>
            </Text>
          ) : null}
          <Text
            className="text-body text-on-primary-muted"
            onLayout={(e) => setCountsWrapped(e.nativeEvent.layout.y > 0)}
          >
            {counts}
          </Text>
        </View>

        {/* In the carousel every card is as tall as the tallest; the buttons sit at the bottom. */}
        <View className="grow" />
        <View className="mt-4 flex-row gap-2">
          <Pill
            label={t("components.invitationCard.decline")}
            loading={declining}
            onPress={onDecline}
          />
          <Pill label={t("components.invitationCard.join")} white onPress={onOpen} />
        </View>

        <Text className="mt-3 text-center text-caption text-on-primary-muted">
          {hours > 0
            ? t("components.invitationCard.expiresIn", { count: hours })
            : t("components.invitationCard.expiresSoon")}
        </Text>
      </View>
    </Pressable>
  );
}

// The card's own buttons: smaller than the screen's pill buttons, white or see-through on the blue.
function Pill({
  label,
  white = false,
  loading = false,
  onPress,
}: {
  label: string;
  white?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      className={`h-11 flex-1 items-center justify-center rounded-full active:opacity-80 ${white ? "bg-white" : "bg-white/15"}`}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text className={`text-subtitle font-semibold ${white ? "text-primary" : "text-white"}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
