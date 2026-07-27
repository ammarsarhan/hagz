import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/shared/Avatar";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

export default function Index() {
    const handleCopyRef = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await Clipboard.setStringAsync(`#`);
    };

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1">
            <SafeAreaView className="p-6 flex-1 gap-y-10">
                <View className="gap-y-3">
                    <View className="mb-2">
                        <Pressable onPress={() => router.push("/(onboarding)/owner/profile")}>
                            <Avatar />
                        </Pressable>
                    </View>
                    <View className="flex-row items-center gap-x-1">
                        <Text className="text-sm text-gray-500">Ref:</Text> 
                        <Pressable onPress={handleCopyRef}>
                            <Text selectable className="text-sm text-gray-500">{`#${"index"}`}</Text>
                        </Pressable>
                    </View>
                    <Text className="text-4xl font-semibold">
                        Your pitch has been submitted successfully!
                    </Text> 
                    <Text className="text-gray-500">
                        Please wait while our team reviews your details. This may take up to 24 hours. A member of our team will get in touch with you shortly.
                    </Text> 
                </View>
            </SafeAreaView>
        </Animated.View>
    )
}