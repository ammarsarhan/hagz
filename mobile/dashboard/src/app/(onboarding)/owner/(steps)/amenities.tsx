import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Amenities() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);

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
                <Header scroll={scroll} progress={65}/>
                <View className="px-6 flex-1 pt-3">
                    <View className="gap-y-3 mb-12">
                        <Text className="text-4xl font-semibold">Select your amenities</Text>
                        <Text className="text-gray-500">You&apos;ll need at least one amenity that applies to your pitch. The more the merrier!</Text>
                    </View>
                </View>
            </KeyboardAwareScrollView>
            <Footer disabled={false} href={"/(onboarding)/owner/(steps)/grounds"}/>
        </Animated.View>
    );
}
