import { IconX } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { Pressable, View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Schedule() {
    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <KeyboardAwareScrollView
                className="flex-1"
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: 24,
                    paddingTop: 24,
                    paddingBottom: 24
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={32}
            >
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconX size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">
                        Edit Schedule
                    </Text>
                    <Text className="text-gray-500">
                        This will be used to generate the available slots for your ground once your venue is approved.
                    </Text>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    )
}