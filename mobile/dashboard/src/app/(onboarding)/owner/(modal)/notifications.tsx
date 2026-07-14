import { IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Notifications() {
    return (
        <SafeAreaView className="flex-1 p-6">
            <View className="mb-3">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={() => router.back()}>
                    <IconChevronLeft size={18}/>
                </Pressable>
            </View>
            <View className="gap-y-1 py-2 mb-10">
                <Text className="text-3xl font-semibold">Notifications</Text> 
                <Text className="text-gray-500">Select your notification delivery channels.</Text> 
            </View>
        </SafeAreaView>
    )
}