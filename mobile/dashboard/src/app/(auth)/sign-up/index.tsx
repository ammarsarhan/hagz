import Button from "@/components/shared/Button";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import { IconCalendarUser, IconUserKey } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
    FadeIn,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function RoleOption({
    selected,
    onPress,
    icon,
    title,
    description,
}: {
    selected: boolean;
    onPress: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    const progress = useSharedValue(selected ? 1 : 0);
    const pressed = useSharedValue(1);

    useEffect(() => {
        progress.value = withTiming(selected ? 1 : 0, { duration: 200 });
    }, [progress, selected]);

    const containerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.value, [0, 1], ["#FFFFFF", "#F3F4F6"]),
        transform: [{ scale: pressed.value }],
    }));

    const radioStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(progress.value, [0, 1], ["#E5E7EB", "#000"]),
    }));

    const dotStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: progress.value }],
    }));

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={() => (pressed.value = withSpring(0.98))}
            onPressOut={() => (pressed.value = withSpring(1))}
            className="p-5 gap-x-6 flex-row items-center rounded-lg border border-gray-100"
            style={containerStyle}
        >
            {icon}
            <View className="flex-1">
                <Text className="text-lg font-semibold">{title}</Text>
                <Text className="text-gray-500 text-sm">{description}</Text>
            </View>
            <Animated.View
                className="size-7 bg-white rounded-full border items-center justify-center"
                style={radioStyle}
            >
                <Animated.View className="size-3.5 rounded-full bg-black" style={dotStyle} />
            </Animated.View>
        </AnimatedPressable>
    );
}

export default function Index() {
    const { state, setField } = useSignUpForm();

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 gap-y-8 px-6">
            <Text className="text-4xl font-semibold">What will you use the dashboard as?</Text>
            <View className="gap-y-3">
                <RoleOption
                    selected={state.role === "OWNER"}
                    onPress={() => setField("role", "OWNER")}
                    icon={<IconUserKey color="#000" strokeWidth={1.6} width={30} height={30} />}
                    title="I am an owner"
                    description="I want to add my venue(s) and accept bookings."
                />
                <RoleOption
                    selected={state.role === "MANAGER"}
                    onPress={() => setField("role", "MANAGER")}
                    icon={<IconCalendarUser color="#000" strokeWidth={1.6} width={30} height={30} />}
                    title="I am a manager"
                    description="I want to help manage a venue's bookings."
                />
            </View>
            <Text className="text-sm text-gray-500">
                By using Hagz, you agree to uphold the platform&apos;s standards in customer service and support.
                You also agree to our Terms and acknowledge that we process your data in accordance with the
                Privacy Policy.
            </Text>
            <Link asChild href={"/(auth)/sign-up/phone"}>
                <Button className="bg-primary">
                    <Text className="text-white font-medium">Next</Text>
                </Button>
            </Link>
        </Animated.View>
    );
}