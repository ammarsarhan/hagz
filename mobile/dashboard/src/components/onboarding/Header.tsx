import { ProgressCircle } from "@/components/onboarding/ProgressCircle";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { Keyboard, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
} from "react-native-reanimated";

export default function Header({
    progress,
    scroll,
}: {
    progress: number;
    scroll: SharedValue<number>;
}) {
    const handleBack = () => {
        Keyboard.dismiss();
        router.back();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            scroll.value,
            [0, 25],
            [1, 0],
            Extrapolation.CLAMP
        ),
    }));

    return (
        <Animated.View style={animatedStyle}>
            <SafeAreaView className="px-6 pt-3 pb-6 items-center justify-between flex-row" edges={['top']}>
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={handleBack}>
                    <IconChevronLeft size={18} />
                </Pressable>
                <ProgressCircle progress={progress} />
            </SafeAreaView>
        </Animated.View>
    );
};