import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

// Picking one of a few options (Figma "Grounds · Add", 352:2 and 353:2).

// A rounded pill, 44 high: grey outline when off, blue outline on a blue tint when chosen. Pills
// wrap, so they suit lists whose labels vary in length (sizes, surfaces).
export function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`h-11 justify-center rounded-full border px-[18px] active:opacity-70 ${selected ? "border-primary bg-blue-tint" : "border-border bg-white"}`}
    >
      <Text className={`text-body font-medium ${selected ? "text-primary" : ""}`}>{label}</Text>
    </Pressable>
  );
}

export function ChoicePills({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2.5">
      {children}
    </View>
  );
}

// Three or so short options sharing one grey track, the chosen one raised in white. For a choice
// whose options are a scale (outdoor, covered, indoor) rather than a list.
export function Segmented<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row rounded-[12px] bg-chip p-[3px]">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            className={`h-[38px] flex-1 items-center justify-center rounded-[10px] ${selected ? "bg-white" : ""}`}
            style={selected ? RAISED : undefined}
          >
            <Text className={`text-body font-medium ${selected ? "" : "text-ink-2"}`}>
              {label(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Figma's 0 1 3 rgba(11,11,12,0.12).
const RAISED = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.12,
  shadowRadius: 1.5,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
