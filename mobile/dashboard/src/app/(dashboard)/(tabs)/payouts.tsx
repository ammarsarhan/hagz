import { IconSettings } from "@tabler/icons-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function Payouts() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName={"gap-y-6 pb-10"}
        contentContainerStyle={{ paddingTop: insets.top / 1.5 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => null}
            tintColor="#6B728055"
            colors={["#6B728055"]}
          />
        }
      >
        <View className="px-6 flex-row items-center justify-between">
          <View className="gap-y-1">
            <Text className="text-4xl font-semibold">Payouts</Text>
            <Text className="text-gray-500">Reconciled as of 24/2/2026</Text>
          </View>
          <Pressable className="size-11 rounded-full bg-gray-100 items-center justify-center">
            <IconSettings width={18} height={18} color="#000000" strokeWidth={2.25}/>
          </Pressable>
        </View>
        <View className="py-6 items-center justify-center gap-y-2">
          <Text className="text-4xl font-semibold">EGP 4124.00</Text>
          <Text className="text-gray-500">+12.5% (EGP 144.25)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
