import { Pressable, Text } from "react-native";
import { IconProps } from "@tabler/icons-react-native";
import type { ComponentType } from "react";

type GroundPillMeta = {
    icon: ComponentType<IconProps>;
    label: { en: string; ar: string };
};

type GroundPillProps = {
    meta: GroundPillMeta;
    selected: boolean;
    pending?: boolean;
    onPress: () => void;
};

export default function GroundPill({ meta, selected, pending, onPress }: GroundPillProps) {
    const { icon: Icon, label } = meta;

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
