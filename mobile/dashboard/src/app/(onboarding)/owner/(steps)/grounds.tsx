import { useState } from "react";
import { View, Text, Pressable, Keyboard } from "react-native";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Footer from "@/components/onboarding/Footer";
import GroundModal from "@/components/onboarding/GroundsModal";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { DraftGround, useGrounds } from "@/lib/hooks/useGrounds";
import { GroundDraftType, sizeMap, sportMap, surfaceMap } from "@/lib/types/ground";
import { IconChevronLeft, IconChevronRight, IconPlus, IconBallFootball, IconArrowsMaximize, IconGrain } from "@tabler/icons-react-native";

export default function Grounds() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);
    const { showActionSheetWithOptions } = useActionSheet();

    const { state } = usePitchDraftForm();
    const { draft } = useDraftQuery();

    const pitchId = draft?.pitchId ?? "";
    const { createMutation, updateMutation, removeMutation } = useGrounds(pitchId);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const grounds = state.grounds as DraftGround[];

    const findGround = (id: string) => grounds.find((item) => item.id === id);

    const isPending = (id: string) =>
        (updateMutation.isPending && updateMutation.variables?.id === id) ||
        (removeMutation.isPending && removeMutation.variables === id);

    const activeGround = activeId ? findGround(activeId) : undefined;

    const handleBack = () => {
        Keyboard.dismiss();
        router.back();
    };

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    const handleAddPress = () => {
        setActiveId(null);
        setModalVisible(true);
    };

    const handleSave = (ground: GroundDraftType) => {
        if (activeGround) {
            updateMutation.mutate({ id: activeGround.id, ground });
        } else {
            createMutation.mutate(ground);
        }
        setModalVisible(false);
    };

    const handleRemove = (id: string) => {
        removeMutation.mutate(id);
        setModalVisible(false);
    };

    const handleGroundPress = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const options = [
            "Edit details",
            "Manage schedule",
            "Cancel",
        ];
        
        const cancelButtonIndex = 2;

        showActionSheetWithOptions(
            { options, cancelButtonIndex },
            (selectedIndex?: number) => {
                switch (selectedIndex) {
                    case 0:
                        {
                            setActiveId(id);
                            setModalVisible(true);
                            break;
                        }
                    case 1:
                        {
                            break;
                        }
                    case 2:
                        {
                            break;
                        }
                    default:
                        break;
                }
            }
        );
    };

    return (
        <>
            <GroundModal
                visible={modalVisible}
                initialValue={activeGround}
                onClose={() => setModalVisible(false)}
                onSave={handleSave}
                onRemove={activeGround ? () => handleRemove(activeGround.id) : undefined}
            />
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
                                                        <Text className="text-gray-600">{sportMap[ground.sport].label.en}</Text>
                                                    </View>
                                                    <View className="flex-row items-center gap-x-1.5">
                                                        <SizeIcon size={15} color="#6B7280" />
                                                        <Text className="text-gray-600">{sizeMap[ground.size].label.en}</Text>
                                                    </View>
                                                    <View className="flex-row items-center gap-x-1.5">
                                                        <SurfaceIcon size={15} color="#6B7280" />
                                                        <Text className="text-gray-600">{surfaceMap[ground.surface].label.en}</Text>
                                                    </View>
                                                </View>
                                                <View>
                                                    <Text className="text-gray-500" numberOfLines={2}>
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
        </>
    );
};
