import { Pressable, Text } from "react-native";
import { AmenityName, getAmenityMeta } from "@/lib/types/amenity";

type AmenityPillProps = {
    name: AmenityName;
    selected: boolean;
    pending?: boolean;
    onPress: () => void;
};

export default function AmenityPill({ name, selected, pending, onPress }: AmenityPillProps) {
    const { icon: Icon, label } = getAmenityMeta(name);

    return (
        <Pressable
            onPress={onPress}
            disabled={pending}
            className={`flex-row items-center rounded-full border px-4 py-2.5 ${
                selected ? "border-primary bg-secondary/10" : "border-gray-200 bg-white"
            } ${pending ? "opacity-50" : ""}`}
        >
            <Icon size={18} color={selected ? "#2B00FF" : "#374151"} />
            <Text className={`ml-2 text-sm font-medium ${selected ? "text-primary" : "text-gray-700"}`}>
                {label.en}
            </Text>
        </Pressable>
    );
}