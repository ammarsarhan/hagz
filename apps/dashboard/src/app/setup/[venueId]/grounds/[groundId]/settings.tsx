import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { MAXIMUM_BOOKING_HOURS } from "@hagz/contracts";
import { Button } from "@/components/button";
import { SectionHeading, StepScreen } from "@/components/step-screen";
import { Stepper } from "@/components/stepper";
import { Text } from "@/components/text";
import { useGroundFlow } from "@/lib/ground-flow";

// Adding a ground, 4 of 4 (Figma "Grounds · Add 4 Booking length", 369:2, renamed Settings so later
// per-ground settings join it as subsections). For now one subsection, booking duration: the
// shortest and longest one booking can be, in whole hours. Each stepper stops at the other, so the
// shortest can never pass the longest. Its button sends the whole ground (lib/ground-flow.tsx).
export default function GroundSettings() {
  const { t } = useTranslation();
  const { ground, draft, update, save, saving } = useGroundFlow();
  const hours = (count: number) => t("screens.setup.grounds.hours", { count });

  return (
    <StepScreen
      title={t("screens.setup.grounds.settingsTitle")}
      subtitle={t("screens.setup.grounds.settingsSubtitle", { name: draft.name.trim() })}
      footer={
        <Button
          label={t(ground ? "common.actions.save" : "screens.setup.grounds.addGround")}
          loading={saving}
          onPress={() => void save()}
        />
      }
    >
      <SectionHeading description={t("screens.setup.grounds.bookingDurationBody")}>
        {t("screens.setup.grounds.bookingDuration")}
      </SectionHeading>
      <Row
        title={t("screens.setup.grounds.shortest")}
        body={t("screens.setup.grounds.shortestBody")}
      >
        <Stepper
          value={draft.minimumSlots}
          min={1}
          max={draft.maximumSlots}
          format={hours}
          label={t("screens.setup.grounds.shortest")}
          decreaseLabel={t("screens.setup.grounds.shorter")}
          increaseLabel={t("screens.setup.grounds.longer")}
          onChange={(minimumSlots) => update({ minimumSlots })}
        />
      </Row>
      <Row title={t("screens.setup.grounds.longest")} body={t("screens.setup.grounds.longestBody")}>
        <Stepper
          value={draft.maximumSlots}
          min={draft.minimumSlots}
          max={MAXIMUM_BOOKING_HOURS}
          format={hours}
          label={t("screens.setup.grounds.longest")}
          decreaseLabel={t("screens.setup.grounds.shorter")}
          increaseLabel={t("screens.setup.grounds.longer")}
          onChange={(maximumSlots) => update({ maximumSlots })}
        />
      </Row>
    </StepScreen>
  );
}

function Row({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border py-[15px]">
      <View className="flex-1">
        <Text className="text-subtitle font-medium leading-[1.31]">{title}</Text>
        <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">{body}</Text>
      </View>
      {children}
    </View>
  );
}
