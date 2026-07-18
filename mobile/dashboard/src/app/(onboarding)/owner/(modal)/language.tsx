import { useRequiredAuth } from "@/context/AuthContext";
import { client } from "@/lib/client";
import { IconCheck, IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    Text,
    View,
} from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseClientError, getErrorMessage } from "@/lib/error";
import { Dispatch, SetStateAction, useState } from "react";

type LanguageType = "EN" | "AR";

type DrawerProps = {
    label: string;
    sublabel: string;
    value: LanguageType;
    pending: LanguageType | null;
    setPending: Dispatch<SetStateAction<LanguageType | null>>;
};

const Drawer = ({
    label,
    sublabel,
    value,
    pending,
    setPending,
}: DrawerProps) => {
    const { user, setUser } = useRequiredAuth();
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressed.value,
            [0, 1],
            ["#FFFFFF", "#F3F4F6"]
        ),
    }));

    const isSelected = user.preferences.language === value;
    const loading = pending === value;
    const isAnyLoading = pending !== null;

    const onPress = async () => {
        if (isSelected || isAnyLoading) return;

        setPending(value);

        try {
            const res = await client.app.profile.preferences.$patch({
                json: { language: value },
            });

            if (res.ok) {
                const { data } = await res.json();
                setUser(data.profile);
                return;
            }

            const error = await parseClientError(res);
            Alert.alert(
                "Language update failed",
                getErrorMessage(error)
            );
        } catch {
            Alert.alert(
                "Connection error",
                "Couldn't connect. Check your connection and try again."
            );
        } finally {
            setPending(null);
        }
    };

    return (
        <Pressable
            disabled={isAnyLoading}
            onPressIn={() => {
                pressed.value = withTiming(isSelected ? 0 : 1, {
                    duration: 100,
                });
            }}
            onPressOut={() => {
                pressed.value = withTiming(0, { duration: 100 });
            }}
            onPress={onPress}
        >
            <Animated.View
                className="flex-row items-center gap-x-5 border-b border-gray-100 py-5 px-3 rounded-lg"
                style={animatedStyle}
            >
                <View className="flex-1 gap-y-1">
                    <Text className="font-medium">{label}</Text>
                    <Text className="text-gray-500 text-sm">{sublabel}</Text>
                </View>
                {
                    loading ? (
                        <View style={{ transform: [{ scale: 0.8 }] }}>
                            <ActivityIndicator
                                size="small"
                                color="#6B7280"
                            />
                        </View>
                    ) : (
                        isSelected && (
                            <IconCheck
                                width={18}
                                height={18}
                                color="#1C04EA"
                            />
                        )
                    )
                }
            </Animated.View>
        </Pressable>
    );
};

export default function Language() {
    const [pending, setPending] = useState<LanguageType | null>(null);

    return (
        <SafeAreaView className="flex-1 p-6">
            <View className="mb-3">
                <Pressable
                    className="size-11 items-center justify-center rounded-full bg-gray-100"
                    onPress={() => router.back()}
                >
                    <IconChevronLeft size={18} />
                </Pressable>
            </View>
            <View className="gap-y-1 py-2 mb-6">
                <Text className="text-3xl font-semibold">
                    Language
                </Text>
                <Text className="text-gray-500">
                    Choose your preferred display language.
                </Text>
            </View>
            <View className="mb-8">
                <Drawer
                    label="English"
                    sublabel="الانجليزية"
                    value="EN"
                    pending={pending}
                    setPending={setPending}
                />
                <Drawer
                    label="عربي"
                    sublabel="Arabic"
                    value="AR"
                    pending={pending}
                    setPending={setPending}
                />
            </View>
            <Text className="text-gray-500 text-sm">
                Changes may take effect on the next application launch.
                Restart the app if needed.
            </Text>
        </SafeAreaView>
    );
}
