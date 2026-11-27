import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { datesLabel } from "@/lib/regulars";
import { Button } from "./button";
import { Sheet } from "./sheet";
import { StepRail, type Step } from "./step-rail";
import { Text } from "./text";

export type SchedulePreview = components["schemas"]["SchedulePreview"];
type Days = components["schemas"]["WeekSchedule"]["days"];

// What new hours would leave behind on one ground or several (copying), summed: the server's
// preview of each, nothing saved (user, 2026-11-27).
export const previewHours = async (venueId: string, groundIds: readonly string[], days: Days) => {
  const results = await Promise.all(
    groundIds.map((groundId) =>
      send(
        api.POST("/v1/staff/venues/{venueId}/grounds/{groundId}/schedule/preview", {
          params: { path: { venueId, groundId } },
          body: { days },
        }),
      ),
    ),
  );
  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return { ok: false as const, error: failed.error };
  const previews = results.flatMap((result) => (result.ok ? [result.data] : []));
  return {
    ok: true as const,
    data: {
      bookings: previews.reduce((sum, one) => sum + one.bookings, 0),
      requests: previews.reduce((sum, one) => sum + one.requests, 0),
      regulars: previews.flatMap((one) => one.regulars),
    } satisfies SchedulePreview,
  };
};

export const leavesSomething = (preview: SchedulePreview) =>
  preview.bookings > 0 || preview.requests > 0 || preview.regulars.length > 0;

const regularStep = (t: TFunction, regular: SchedulePreview["regulars"][number]): Step => ({
  // It ends when saved; its confirmed weeks still happen (user, 2026-11-27).
  label: t("screens.setup.hours.change.regularEnds", { name: regular.name }),
  detail: regular.lastWeek
    ? t("screens.setup.hours.change.regularBody", { date: datesLabel(t, [regular.lastWeek]) })
    : t("screens.setup.hours.change.regularBodyNone"),
  when: "",
  state: "now",
});

// Changing hours, asked first when it closes hours with something in them (user, 2026-11-27): a
// sheet with what follows on the step rail, as deleting a ground: waiting requests in those hours
// are declined, bookings in them go ahead, regulars whose time closes keep their reserved weeks and
// end after the last, then new bookings follow the new hours. Cancel and Save side by side; Save
// saves, with no second alert (user, 2026-11-27).
export function ScheduleChangeSheet({
  title,
  copying = false,
  lastOpen = false,
  preview,
  visible,
  onClose,
  onHidden,
  onConfirm,
}: {
  title: string;
  // Copying to other grounds: Copy, not Save.
  copying?: boolean;
  // It closes the last hours open at a running venue: nothing's left to book (user, 2026-11-27).
  lastOpen?: boolean;
  preview: SchedulePreview;
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const c = "screens.setup.hours.change";
  const { bookings, requests, regulars } = preview;

  const steps: Step[] = [
    ...(lastOpen
      ? [
          {
            label: t(`${c}.lastOpen`),
            detail: t(`${c}.lastOpenBody`),
            when: "",
            state: "now" as const,
          },
        ]
      : []),
    ...(requests > 0
      ? [
          {
            label: t(`${c}.requests`, { count: requests }),
            detail: t(`${c}.requestsBody`),
            when: "",
            state: "now" as const,
          },
        ]
      : []),
    ...(bookings > 0
      ? [
          {
            label: t(`${c}.bookings`, { count: bookings }),
            detail: t(`${c}.bookingsBody`),
            when: "",
            state: "now" as const,
          },
        ]
      : []),
    ...regulars.map((regular) => regularStep(t, regular)),
    { label: t(`${c}.after`), detail: t(`${c}.afterBody`), when: "", state: "next" },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      scrollable
      footer={
        <View className="mt-8 flex-row gap-3">
          <View className="flex-1">
            <Button label={t(`${c}.cancel`)} variant="secondary" compact onPress={onClose} />
          </View>
          <View className="flex-1">
            <Button
              label={t(copying ? `${c}.copyConfirm` : `${c}.confirm`)}
              compact
              onPress={onConfirm}
            />
          </View>
        </View>
      }
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-6 text-[22px] font-semibold leading-[1.27]">
        {title}
      </Text>
      <StepRail gap={22} steps={steps} />
    </Sheet>
  );
}
