import { IconX } from "@tabler/icons-react-native";
import { Modal, View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    LocationAccordion,
    LocationAccordionSkeleton,
} from "@/components/shared/location/LocationAccordion";
import { Area } from "@/lib/types/location";
import { useLocations } from "@/lib/hooks";

interface LocationModalProps {
    open: boolean;
    onClose: () => void;
    onSelect?: (area: Area) => void;
    location?: string;
}

export default function LocationModal({
    open,
    onClose,
    onSelect,
    location,
}: LocationModalProps) {
    const query = useLocations();

    const handleSelect = (area: Area) => {
        onSelect?.(area);
        onClose();
    };

    return (
        <Modal
            visible={open}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
            allowSwipeDismissal
        >
            <ScrollView className="flex-1">
                <SafeAreaView className="flex-1 p-6">
                    <View className="mb-3">
                        <Pressable
                            className="size-11 items-center justify-center rounded-full bg-gray-100"
                            onPress={onClose}
                        >
                            <IconX size={18} />
                        </Pressable>
                    </View>
                    <View className="gap-y-1 py-2 mb-6">
                        <Text className="text-3xl font-semibold">Locations</Text>
                        <Text className="text-gray-500">
                            Choose the area closest to your venue from the platform&apos;s
                            location coverage list.
                        </Text>
                    </View>
                    {
                        query.isLoading && <LocationAccordionSkeleton rows={3}/>
                    }
                    {
                        query.isError && (
                            <View className="py-10 items-center">
                                <Text className="text-gray-500">
                                    Couldn&apos;t load locations. Pull down to try again.
                                </Text>
                            </View>
                        )
                    }
                    {
                        query.data && (
                            <LocationAccordion
                                governorates={query.data.locations}
                                selectedAreaId={location}
                                onSelectArea={handleSelect}
                            />
                        )
                    }
                </SafeAreaView>
            </ScrollView>
        </Modal>
    );
}