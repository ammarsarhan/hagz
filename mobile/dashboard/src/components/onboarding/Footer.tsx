import { IconChevronDown } from "@tabler/icons-react-native";
import { Text, Keyboard, Pressable } from "react-native";
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from "react-native-reanimated";
import Button from "@/components/shared/Button";
import { Href, Link } from "expo-router";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Footer({ disabled, href, onPress } : { disabled: boolean, href?: Href, onPress?: () => void }) {
    if (href && onPress) throw new Error("Can not pass both an href and an onPress.");

    const insets = useSafeAreaInsets();
    const { progress } = useReanimatedKeyboardAnimation();

    const containerStyle = useAnimatedStyle(() => ({
        paddingBottom: interpolate(
            progress.value,
            [0, 1],
            [insets.bottom, insets.bottom - 10],
            Extrapolation.CLAMP
        ),
    }));

    const chevronStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            progress.value,
            [0, 1],
            [0, 1],
            Extrapolation.CLAMP
        ),
        transform: [
            {
                scale: interpolate(
                    progress.value,
                    [0, 1],
                    [0.6, 1],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    return (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} className="absolute bottom-0 left-0 right-0" pointerEvents="box-none">
            <Animated.View 
                className="px-6 py-3 flex-row items-center justify-between bg-transparent"
                style={containerStyle}
                pointerEvents="box-none"
            >
                <AnimatedPressable 
                    className="size-14 items-center justify-center rounded-full bg-gray-100" 
                    onPress={Keyboard.dismiss}
                    style={chevronStyle}
                >
                    <IconChevronDown size={22} />
                </AnimatedPressable>
                {
                    href &&
                    <Link asChild href={href}>
                        <Button onPress={Keyboard.dismiss} className="bg-primary border-primary w-32 py-4" disabled={disabled}>
                            <Text className="text-white font-medium">Next</Text>
                        </Button>
                    </Link>
                }
                {
                    onPress &&
                    <Button onPress={onPress} className="bg-primary border-primary w-32 py-4" disabled={disabled}>
                        <Text className="text-white font-medium">Next</Text>
                    </Button>
                }
            </Animated.View>
        </KeyboardStickyView>
    )
}