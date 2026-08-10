import { View, Text, Pressable, Keyboard } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { useQuery } from "@tanstack/react-query";
import { usePitch } from "@/context/PitchContext";
import { useStaffDetails } from "@/lib/hooks/team";

export default function Details() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const handleBack = () => {
        router.back();
        Keyboard.dismiss();
    };

    const { pitch, isLoading: isPitchLoading } = usePitch();
    const pitchId = pitch?.id ?? "";

    const {
        data: details,
        isLoading: isDetailsLoading,
        isRefetching: isDetailsRefetching,
        refetch: refetchDetails,
    } = useStaffDetails(pitchId, id);

    return (
        <View className="flex-1">
            <View className="h-2/5 bg-gray-200 rounded-b-2xl">
                <SafeAreaView className="flex-1 px-6 py-2" edges={["top"]}>
                    <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={handleBack}>
                        <IconChevronLeft size={18} />
                    </Pressable>
                </SafeAreaView>

            </View>
        </View>
    );
}