import { View } from "react-native";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// "What happens next" (user, 2026-11-25, in place of grey info boxes): a dot per step on a thin
// light rail, what happens on the left and when on the right. A dashed ring is the step being
// taken now, a solid ring the next, a grey ring a branch that may not happen, and a filled dot a
// step done.
export type StepState = "now" | "next" | "maybe" | "done";

export interface Step {
  label: string;
  when: string;
  state: StepState;
  // The when in weight (the deadline that matters: "15 min").
  strong?: boolean;
}

const ROW = 32;

export function StepRail({ steps }: { steps: Step[] }) {
  return (
    <View>
      {steps.map((step, index) => (
        <View key={step.label} className="flex-row items-center" style={{ height: ROW }}>
          <View className="w-3.5 items-center self-stretch justify-center">
            {/* The rail: from the row above's dot to the row below's, behind this one's. */}
            <View
              className="absolute w-px bg-border"
              style={{
                top: index === 0 ? ROW / 2 : 0,
                bottom: index === steps.length - 1 ? ROW / 2 : 0,
              }}
            />
            <Dot state={step.state} />
          </View>
          <Text
            className={`ms-3 flex-1 text-body ${step.state === "maybe" ? "text-ink-2" : ""}`}
            numberOfLines={1}
          >
            {step.label}
          </Text>
          <Text
            className={`ms-3 text-body ${step.strong ? "font-semibold" : step.state === "maybe" || step.state === "now" ? "text-ink-2" : ""}`}
          >
            {step.when}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Dot({ state }: { state: StepState }) {
  if (state === "now")
    return (
      <View
        className="size-3.5 rounded-full bg-white"
        style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.ink }}
      />
    );
  if (state === "done") return <View className="size-2.5 rounded-full bg-ink" />;
  return (
    <View
      className="size-2.5 rounded-full bg-white"
      style={{ borderWidth: 1.5, borderColor: state === "maybe" ? colors.ink3 : colors.ink }}
    />
  );
}
