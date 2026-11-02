import { VariableContextProvider } from "nativewind";
import { View } from "react-native";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { FONT_FAMILIES } from "@/lib/fonts";

// Styling trial (NativeWind 5 on Expo 58, in Expo Go): the pill button in every state, then the
// same row left-to-right in Inter and right-to-left in Noto Sans Arabic, to check that start/end
// margins flip and the font families swap.
export default function Home() {
  return (
    <Screen>
      <Text className="mt-6 text-title font-semibold">Styling check</Text>
      <Text className="mt-1.5 text-subtitle text-ink-2">NativeWind 5 · Tailwind 4 · Expo Go</Text>

      <View className="mt-8 gap-2.5">
        <Button label="Create account" />
        <Button label="Create your venue" variant="secondary" />
        <Button label="Have a code?" variant="ghost" />
        <Button label="Continue" disabled />
      </View>

      <View className="mt-8 gap-3">
        <Row label="Regular, medium and semibold" />
        <VariableContextProvider value={FONT_FAMILIES.ar}>
          <View style={{ direction: "rtl" }}>
            <Row label="عادي، متوسط وعريض" />
          </View>
        </VariableContextProvider>
      </View>
    </Screen>
  );
}

// The label in regular, then "Aa" in medium and semibold.
function Row({ label }: { label: string }) {
  return (
    <View className="h-14 flex-row items-center rounded-field border border-border px-4">
      <View className="size-6 rounded-full bg-primary" />
      <Text className="ms-3 text-subtitle">{label}</Text>
      <Text className="ms-2 text-subtitle font-medium">Aa</Text>
      <Text className="ms-2 text-subtitle font-semibold">Aa</Text>
    </View>
  );
}
