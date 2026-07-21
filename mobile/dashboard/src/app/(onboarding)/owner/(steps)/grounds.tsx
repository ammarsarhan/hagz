import Footer from "@/components/onboarding/Footer";
import { IconChevronLeft, IconPlus } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { View, Text, Pressable, Keyboard } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function Grounds() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);

    const handleBack = () => {
        Keyboard.dismiss();
        router.back();
    };

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 bg-white">
            <KeyboardAwareScrollView
                className="flex-1"
                bottomOffset={120 + insets.bottom}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
            >
                <SafeAreaView className="px-6 pt-3 pb-6 items-center justify-between flex-row" edges={['top']}>
                    <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={handleBack}>
                        <IconChevronLeft size={18} />
                    </Pressable>
                    <Pressable className="size-11 items-center justify-center rounded-full bg-primary/5">
                        <IconPlus size={18} color="#1C04EA"/>
                    </Pressable>
                </SafeAreaView>
                <View className="px-6 flex-1 pt-3">
                    <View className="gap-y-3 mb-12">
                        <Text className="text-4xl font-semibold">Add your grounds</Text>
                        <Text className="text-gray-500">You need at least one ground within your venue to finalize your pitch.</Text>
                    </View>
                    
                </View>
            </KeyboardAwareScrollView>
            <Footer disabled={false} onPress={() => null}/>
        </Animated.View>
    );
}
