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
import { useMutation } from "@tanstack/react-query";
import { ApiError, parseClientError } from "@/lib/error";

type LanguageType = "EN" | "AR";

type DrawerProps = {
    label: string;
    sublabel: string;
    value: LanguageType;
    pendingValue: LanguageType | undefined;
    isAnyLoading: boolean;
    onSelect: (value: LanguageType) => void;
};

const Drawer = ({
    label,
    sublabel,
    value,
    pendingValue,
    isAnyLoading,
    onSelect,
}: DrawerProps) => {
    const { user } = useRequiredAuth();
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressed.value,
            [0, 1],
            ["#FFFFFF", "#F3F4F6"]
        ),
    }));

    const isSelected = user.preferences.language === value;
    const loading = pendingValue === value;

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
            onPress={() => {
                if (isSelected || isAnyLoading) return;
                onSelect(value);
            }}
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
    const { setUser } = useRequiredAuth();

    const updateLanguageMutation = useMutation({
        mutationFn: async (language: LanguageType) => {
            const res = await client.app.profile.preferences.$patch({
                json: { language },
            });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data.profile;
        },
        onSuccess: (profile) => {
            setUser(profile);
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                Alert.alert("Language update failed", err.message);
            } else {
                Alert.alert(
                    "Connection error",
                    "Couldn't connect. Check your connection and try again."
                );
            }
        },
    });

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
                    pendingValue={updateLanguageMutation.isPending ? updateLanguageMutation.variables : undefined}
                    isAnyLoading={updateLanguageMutation.isPending}
                    onSelect={(value) => updateLanguageMutation.mutate(value)}
                />
                <Drawer
                    label="عربي"
                    sublabel="Arabic"
                    value="AR"
                    pendingValue={updateLanguageMutation.isPending ? updateLanguageMutation.variables : undefined}
                    isAnyLoading={updateLanguageMutation.isPending}
                    onSelect={(value) => updateLanguageMutation.mutate(value)}
                />
            </View>
            <Text className="text-gray-500 text-sm">
                Changes may take effect on the next application launch.
                Restart the app if needed.
            </Text>
        </SafeAreaView>
    );
}
