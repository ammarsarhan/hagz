import { View, Text, Pressable, Keyboard } from "react-native";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import Footer from "@/components/onboarding/Footer";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { DraftGround, useGrounds } from "@/lib/hooks/useGrounds";
import { sizeMap, sportMap, surfaceMap } from "@/lib/types/ground";
import { IconChevronLeft, IconChevronRight, IconPlus } from "@tabler/icons-react-native";

export default function Grounds() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);
    const { state } = usePitchDraftForm();
    const { draft } = useDraftQuery();

    const pitchId = draft?.pitchId ?? "";
    const { updateMutation, removeMutation } = useGrounds(pitchId);

    const grounds = state.grounds as DraftGround[];

    const isPending = (id: string) =>
        (updateMutation.isPending && updateMutation.variables?.id === id) ||
        (removeMutation.isPending && removeMutation.variables === id);

    const handleBack = () => {
        Keyboard.dismiss();
        router.back();
    };

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    const handleAddPress = () => {
        router.push("/(onboarding)/owner/(steps)/(modal)");
    };

    const handleGroundPress = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(`/(onboarding)/owner/(steps)/(modal)?id=${id}`);
    };

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
                    <Pressable className="size-11 items-center justify-center rounded-full bg-primary/5" onPress={handleAddPress}>
                        <IconPlus size={18} color="#1C04EA" />
                    </Pressable>
                </SafeAreaView>
                <View className="px-6 flex-1 pt-3">
                    <View className="gap-y-3 mb-12">
                        <Text className="text-4xl font-semibold">Your grounds</Text>
                        <Text className="text-gray-500">You need at least one ground within your venue to finalize your pitch.</Text>
                    </View>
                    <View className="gap-y-4">
                        {
                            grounds.map((ground) => {
                                const SportIcon = sportMap[ground.sport].icon;
                                const SizeIcon = sizeMap[ground.size].icon;
                                const SurfaceIcon = surfaceMap[ground.surface].icon;

                                return (
                                    <Pressable
                                        key={ground.id}
                                        onPress={() => handleGroundPress(ground.id)}
                                        disabled={isPending(ground.id)}
                                        className="flex-row items-start justify-between gap-x-6 rounded-lg border border-gray-200 bg-white p-5 disabled:opacity-50"
                                    >
                                        <View className="flex-1 shrink">
                                            <Text className="text-xl font-medium">{ground.name}</Text>
                                            <View className="flex-row flex-wrap gap-x-4 gap-y-2 mt-2.5 mb-6">
                                                <View className="flex-row items-center gap-x-1.5">
                                                    <SportIcon size={15} color="#6B7280" />
                                                    <Text className="text-gray-600 text-sm">{sportMap[ground.sport].label.en}</Text>
                                                </View>
                                                <View className="flex-row items-center gap-x-1.5">
                                                    <SizeIcon size={15} color="#6B7280" />
                                                    <Text className="text-gray-600 text-sm">{sizeMap[ground.size].label.en}</Text>
                                                </View>
                                                <View className="flex-row items-center gap-x-1.5">
                                                    <SurfaceIcon size={15} color="#6B7280" />
                                                    <Text className="text-gray-600 text-sm">{surfaceMap[ground.surface].label.en}</Text>
                                                </View>
                                            </View>
                                            <View className="self-start px-4 py-2.5 rounded-full border border-primary bg-secondary/10">
                                                <Text className="text-primary font-medium text-[0.8rem]">
                                                    EGP {ground.basePrice}.00/hr
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="w-[18px] items-center pt-1">
                                            <IconChevronRight size={18} color="#9CA3AF" />
                                        </View>
                                    </Pressable>
                                );
                            })
                        }
                    </View>
                </View>
            </KeyboardAwareScrollView>
            <Footer disabled={grounds.length <= 0} onPress={() => null} />
        </Animated.View>
    );
};
