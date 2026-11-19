import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { resetOnboarding } from "@/lib/onboarding";

// Where a guest lands after onboarding. A placeholder until Phase 3's Home: lime and black from the
// customer theme. Development builds can replay onboarding from here, since it shows only once.
export default function Home() {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-primary">
      <Text className="text-title font-semibold text-on-primary">Hagz</Text>
      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            resetOnboarding();
            router.replace("/");
          }}
          className="active:opacity-60"
        >
          <Text className="text-subtitle font-medium text-on-primary underline">
            Show onboarding again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
