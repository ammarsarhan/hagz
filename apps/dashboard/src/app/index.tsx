import { Text, View } from "react-native";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";

// Styling trial (NativeWind 5 on Expo 58, in Expo Go): the pill button in every state, then the
// same row left-to-right and right-to-left to check that start/end margins flip.
export default function Home() {
  return (
    <Screen>
      <Text className="mt-6 text-[28px] font-semibold leading-[34px] text-ink">Styling check</Text>
      <Text className="mt-1.5 text-base text-ink-2">NativeWind 5 · Tailwind 4 · Expo Go</Text>

      <View className="mt-8 gap-2.5">
        <Button label="Create account" />
        <Button label="Create your venue" variant="secondary" />
        <Button label="Have a code?" variant="ghost" />
        <Button label="Continue" disabled />
      </View>

      <View className="mt-8 gap-3">
        <Row label="Left to right" />
        <View style={{ direction: "rtl" }}>
          <Row label="من اليمين إلى اليسار" />
        </View>
      </View>
    </Screen>
  );
}

function Row({ label }: { label: string }) {
  return (
    <View className="h-14 flex-row items-center rounded-[14px] border border-border px-4">
      <View className="size-6 rounded-full bg-blue" />
      <Text className="ms-3 text-base text-ink">{label}</Text>
    </View>
  );
}
