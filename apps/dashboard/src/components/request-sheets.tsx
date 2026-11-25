import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { localDateOf, type StaffBooking } from "@/lib/calendar";
import { decimalsOf, formatAmount } from "@/lib/money";
import { hoursSpan, relativeDay } from "@/lib/when";
import { Button } from "./button";
import { Field } from "./field";
import { useHud } from "./hud";
import { Sheet } from "./sheet";
import { StepRail } from "./step-rail";
import { Text } from "./text";

// The answers to a booking request (Figma D7 round 3): each asks first, in a sheet.
//
// Approve (539:2): which game, then, at venues paid online, what happens next as a rail: you
// approve now, the player pays within the window approving gives them, or it's let go. Paid at the
// venue, approving confirms it and there's nothing more to say.
//
// Decline (540:2): which game, that the player is told and the time frees up, and an optional
// reason shown to them.
//
// Either way, once answered, the venue's bookings are read again (the request leaves the list and
// the Calendar's count, the game shows on its day), with no message: the change shows where it was
// answered (user). A failure (one let go meanwhile, say) goes to the HUD, once the sheet has slid
// away so it doesn't flash inside it, and the requests are read again too.

export type Answer = "approve" | "decline";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function RequestSheet({
  request,
  answer,
  visible,
  now,
  onClose,
  onHidden,
}: {
  request: StaffBooking;
  answer: Answer;
  visible: boolean;
  now: number;
  onClose: () => void;
  onHidden: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState("");
  // What went wrong, said once the sheet has gone.
  const failure = useRef<string | null>(null);

  const { timezone, currency } = request;
  const name = firstName(request.customer.name);
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const day = relativeDay(localDateOf(request.startsAt, timezone), now, timezone, t);
  const hours = hoursSpan(request.startsAt, request.endsAt, timezone, t);
  const ground = request.ground.name ?? "";

  const submit = async () => {
    setSending(true);
    const path = { venueId: request.venue.id, bookingId: request.id };
    const result =
      answer === "approve"
        ? await send(
            api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/approve", {
              params: { path },
            }),
          )
        : await send(
            api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/decline", {
              params: { path },
              body: reason.trim() ? { reason: reason.trim() } : {},
            }),
          );
    setSending(false);
    void queryClient.invalidateQueries({
      queryKey: ["staff", "venues", request.venue.id, "bookings"],
    });
    if (!result.ok) failure.current = hudMessage(result.error);
    onClose();
  };

  // What approving leads to, at venues paid online.
  const payable =
    answer === "approve" && request.paymentMode !== "MANUAL" && request.paymentWindow !== null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        const said = failure.current;
        failure.current = null;
        if (said) hud.show(said);
        onHidden();
      }}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t(
          answer === "approve" ? "screens.requests.approveTitle" : "screens.requests.declineTitle",
          { name },
        )}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {answer === "approve"
          ? t("screens.requests.approveWhat", { day, hours, ground, price: money(request.total) })
          : t("screens.requests.declineWhat", { day, hours, ground, name })}
      </Text>

      {payable ? (
        <View className="-mt-2 mb-8">
          <StepRail
            steps={[
              {
                label: t("screens.requests.youApprove"),
                when: t("screens.requests.now"),
                state: "now",
              },
              {
                label:
                  request.paymentMode === "DEPOSIT" && request.deposit !== null
                    ? t("screens.requests.paysDeposit", { name, amount: money(request.deposit) })
                    : t("screens.requests.pays", { name, amount: money(request.total) }),
                when: t("screens.requests.minutes", { count: request.paymentWindow ?? 0 }),
                state: "next",
                strong: true,
              },
              {
                label: t("screens.requests.notPaid"),
                when: t("screens.requests.letGo"),
                state: "maybe",
              },
            ]}
          />
        </View>
      ) : null}

      {answer === "decline" ? (
        // The field keeps 16 under itself.
        <View className="mb-2">
          <Field
            label={t("screens.requests.reason")}
            value={reason}
            onChangeText={setReason}
            placeholder={t("screens.requests.reasonHint", { name })}
            maxLength={500}
          />
        </View>
      ) : null}

      <Button
        label={t(
          answer === "approve"
            ? "screens.requests.approveBooking"
            : "screens.requests.declineBooking",
        )}
        variant={answer === "approve" ? "primary" : "ink"}
        loading={sending}
        onPress={() => void submit()}
      />
    </Sheet>
  );
}
