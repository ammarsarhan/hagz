import { useState } from "react";
import AmenityModal from "@/components/onboarding/AmenityModal";
import AmenityPill from "@/components/onboarding/AmenityPill";
import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { DraftAmenity, useAmenities } from "@/lib/hooks/useAmenities";
import { Amenity, amenityMap } from "@/lib/types/amenity";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const amenityNames = Object.keys(amenityMap) as Amenity["name"][];

export default function Amenities() {
    const { state } = usePitchDraftForm();
    const { draft } = useDraftQuery();
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);

    const [activeName, setActiveName] = useState<Amenity["name"] | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const pitchId = draft?.pitchId ?? "";
    const { createMutation, updateMutation, removeMutation } = useAmenities(pitchId);

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    const findAmenity = (name: Amenity["name"]) =>
        (state.amenities as DraftAmenity[]).find((item) => item.name === name);

    const isPending = (name: Amenity["name"]) =>
        (createMutation.isPending && createMutation.variables?.name === name) ||
        (updateMutation.isPending && findAmenity(name)?.order === updateMutation.variables?.order) ||
        (removeMutation.isPending && findAmenity(name)?.order === removeMutation.variables);

    const handlePillPress = (name: Amenity["name"]) => {
        setActiveName(name);
        setModalVisible(true);
    };

    const activeAmenity = activeName ? findAmenity(activeName) : undefined;

    const handleSave = (amenity: Amenity) => {
        if (activeAmenity?.order !== undefined) {
            updateMutation.mutate({ order: activeAmenity.order, amenity });
        } else {
            createMutation.mutate(amenity);
        }
    };

    const handleRemove = () => {
        if (activeAmenity?.order !== undefined) {
            removeMutation.mutate(activeAmenity.order);
        }
    };

    return (
        <>
            <AmenityModal
                visible={modalVisible}
                name={activeName}
                initialValue={activeAmenity}
                onClose={() => setModalVisible(false)}
                onSave={handleSave}
                onRemove={activeAmenity ? handleRemove : undefined}
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
                    <Header scroll={scroll} progress={65} />
                    <View className="px-6 flex-1 pt-3">
                        <View className="gap-y-3 mb-12">
                            <Text className="text-4xl font-semibold">Select your amenities</Text>
                            <Text className="text-gray-500">You&apos;ll need at least one amenity that applies to your pitch. The more the merrier!</Text>
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                            {
                                amenityNames.map((name) => (
                                    <AmenityPill
                                        key={name}
                                        name={name}
                                        selected={!!findAmenity(name)}
                                        pending={isPending(name)}
                                        onPress={() => handlePillPress(name)}
                                    />
                                ))
                            }
                        </View>
                    </View>
                </KeyboardAwareScrollView>
                <Footer disabled={state.amenities.length <= 0} href={"/(onboarding)/owner/draft/(steps)/grounds"} />
            </Animated.View>
        </>
    );
}