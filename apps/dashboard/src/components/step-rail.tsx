import { View } from "react-native";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// "What happens next" (user, 2026-11-25, in place of grey info boxes): a dot per step on a thin
// light rail, what happens on the left (with an optional grey line under it) and when on the right.
// A dashed ring is the step being taken now, a solid ring the next, a grey ring a branch that may
// not happen, and a filled dot a step done.
export type StepState = "now" | "next" | "maybe" | "done";

export interface Step {
  label: string;
  when: string;
  state: StepState;
  // A grey line under the label: who did it, how much ("Mona", "450 EGP online").
  detail?: string;
  // What's in weight: the step being waited on ("Ahmed pays the 300 EGP deposit"), or its time
  // when that's what matters ("15 min").
  bold?: "label" | "when";
}

// The label's line, which the dot centres on, and the room between steps.
const LINE = 21;
const GAP = 14;

export function StepRail({ steps }: { steps: Step[] }) {
  return (
    <View>
      {steps.map((step, index) => {
        const first = index === 0;
        const last = index === steps.length - 1;
        const maybe = step.state === "maybe";
        return (
          <View
            key={step.label}
            className="flex-row items-start"
            style={{ paddingBottom: last ? 0 : GAP }}
          >
            <View className="w-3.5 items-center self-stretch">
              {/* The rail into this dot and on to the next, under it. */}
              {steps.length > 1 ? (
                <View
                  className="absolute w-px bg-border"
                  style={{
                    top: first ? LINE / 2 : 0,
                    bottom: last ? undefined : 0,
                    height: last ? LINE / 2 : undefined,
                  }}
                />
              ) : null}
              <View className="items-center justify-center" style={{ height: LINE }}>
                <Dot state={step.state} />
              </View>
            </View>
            <View className="ms-3 flex-1">
              <Text
                className={`text-body leading-[21px] ${step.bold === "label" ? "font-semibold" : ""} ${maybe ? "text-ink-3" : ""}`}
              >
                {step.label}
              </Text>
              {step.detail ? (
                <Text className={`text-caption ${maybe ? "text-ink-3" : "text-ink-2"}`}>
                  {step.detail}
                </Text>
              ) : null}
            </View>
            <Text
              className={`ms-3 text-label leading-[21px] ${step.bold === "when" ? "font-semibold text-ink" : maybe ? "text-ink-3" : "text-ink-2"}`}
            >
              {step.when}
            </Text>
          </View>
        );
      })}
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
