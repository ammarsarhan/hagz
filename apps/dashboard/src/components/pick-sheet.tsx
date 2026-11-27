import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Wheel, WheelBand, type WheelItem } from "@/components/wheel";

export interface SheetWheel {
  label: string;
  items: WheelItem<number>[];
  value: number;
}

// A wheel sheet (Figma 645:176 / 645:333, D12 719:3): its title and line, one or two wheels on one
// band, and Done, grey until a wheel differs from what it opened on. Give it a key per opening.
export function PickSheet({
  visible,
  title,
  body,
  wheels,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  body: string;
  wheels: SheetWheel[];
  onClose: () => void;
  onDone: (values: number[]) => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => wheels.map((wheel) => wheel.value));
  const changed = values.some((value, i) => value !== wheels[i]?.value);
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {title}
      </Text>
      <Text className="mt-2 text-subtitle text-ink-2">{body}</Text>
      <View className="relative mt-5 flex-row">
        <WheelBand />
        {wheels.map((wheel, i) => (
          <Wheel
            key={wheel.label}
            label={wheel.label}
            items={wheel.items}
            value={wheel.value}
            onChange={(value) =>
              setValues((current) => current.map((old, at) => (at === i ? value : old)))
            }
          />
        ))}
      </View>
      <View className="mt-6">
        <Button
          label={t("screens.bookingSettings.done")}
          disabled={!changed}
          onPress={() => onDone(values)}
        />
      </View>
    </Sheet>
  );
}
