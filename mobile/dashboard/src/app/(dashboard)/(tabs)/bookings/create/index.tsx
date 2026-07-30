import { IconX } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <View className="flex-1 p-6">
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconX size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Customer Details</Text>
                    <Text className="text-gray-500">We&apos;ll use these details to identify the customer and manage their booking.</Text>
                </View>
                <View>
                    
                </View>
            </View>
        </SafeAreaView>
    )
}