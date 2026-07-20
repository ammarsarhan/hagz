import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
    createAnimatedComponent,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    interpolate,
    interpolateColor,
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    type SharedValue,
} from "react-native-reanimated";
import { IconChevronDown, IconCheck } from "@tabler/icons-react-native";
import { Area, Governorate } from "@/lib/types/location";
import cn from "@/lib/cn";

const AnimatedPressable = createAnimatedComponent(Pressable);

interface AreaRowProps {
    area: Area;
    selected: boolean;
    onSelect: (area: Area) => void;
}

interface AccordionItemProps {
    governorate: Governorate;
    isOpen: boolean;
    onToggle: () => void;
    selectedAreaId?: string;
    onSelectArea: (area: Area) => void;
}

interface SkeletonBlockProps {
    className: string;
    opacity: SharedValue<number>;
}

interface LocationAccordionSkeletonProps {
    rows?: number;
}

interface LocationAccordionProps {
    governorates: Governorate[];
    selectedAreaId?: string;
    onSelectArea: (area: Area) => void;
}

const AreaRow = ({ area, selected, onSelect }: AreaRowProps) => {
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(pressed.value, [0, 1], ["#FFFFFF", "#F3F4F6"]),
    }));

    return (
        <AnimatedPressable
            onPressIn={() => (pressed.value = withTiming(1, { duration: 100 }))}
            onPressOut={() => (pressed.value = withTiming(0, { duration: 100 }))}
            onPress={() => onSelect(area)}
            className="flex-row items-center justify-between rounded-lg px-3 py-4"
            style={animatedStyle}
        >
            <Text className={selected ? "font-medium text-black" : "text-gray-500"}>
                {area.name}
            </Text>
            {
                selected && <IconCheck size={16} className="text-primary" />
            }
        </AnimatedPressable>
    );
};

const AccordionItem = ({
    governorate,
    isOpen,
    onToggle,
    selectedAreaId,
    onSelectArea,
}: AccordionItemProps) => {
    const pressed = useSharedValue(0);
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(isOpen ? 1 : 0, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
        });
    }, [isOpen, progress]);

    const rowStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(pressed.value, [0, 1], ["#FFFFFF", "#F3F4F6"]),
    }));

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
    }));

    const hasSelection = governorate.areas.some((a) => a.id === selectedAreaId);

    return (
        <Animated.View layout={LinearTransition.duration(250)} className={"border-b border-gray-100"}>
            <AnimatedPressable
                onPressIn={() => (pressed.value = withTiming(1, { duration: 100 }))}
                onPressOut={() => (pressed.value = withTiming(0, { duration: 100 }))}
                onPress={onToggle}
                className="flex-row items-center gap-x-4 py-5 px-3 rounded-lg"
                style={rowStyle}
            >
                <View className="flex-1">
                    <Text className={"font-medium"}>{governorate.name}</Text>
                    <Text className="text-gray-500 text-sm">
                        {hasSelection ? "Selected" : `${governorate.areas.length} areas`}
                    </Text>
                </View>
                <Animated.View style={chevronStyle}>
                    <IconChevronDown width={18} height={18} color="#6B7280" />
                </Animated.View>
            </AnimatedPressable>

            {isOpen && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    layout={LinearTransition.duration(250).easing(Easing.out(Easing.cubic))}
                    style={{ overflow: "hidden" }}
                >
                    <View className="px-2 pb-3 gap-y-0.5">
                        {governorate.areas.map((area) => (
                            <AreaRow
                                key={area.id}
                                area={area}
                                selected={area.id === selectedAreaId}
                                onSelect={onSelectArea}
                            />
                        ))}
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
};

const SkeletonBlock = ({ className, opacity }: SkeletonBlockProps) => {
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return <Animated.View style={style} className={`bg-gray-200 rounded-md ${className}`} />;
};

export const LocationAccordionSkeleton = ({ rows = 3 }: LocationAccordionSkeletonProps) => {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [opacity]);

    return (
        <View>
            {
                Array.from({ length: rows }).map((_, i) => (
                    <View
                        key={i}
                        className="flex-row items-center gap-x-4 py-5 px-3 border-b border-gray-100"
                    >
                        <View className="flex-1 gap-y-2">
                            <SkeletonBlock className="h-4 w-28" opacity={opacity} />
                            <SkeletonBlock className="h-3 w-16" opacity={opacity} />
                        </View>
                        <SkeletonBlock className="size-4 rounded-full" opacity={opacity} />
                    </View>
                ))
            }
        </View>
    );
};

export const LocationAccordion = ({
    governorates,
    selectedAreaId,
    onSelectArea,
}: LocationAccordionProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(
        governorates.find((g) => g.areas.some((a) => a.id === selectedAreaId))?.id ?? null
    );

    return (
        <View>
            {
                governorates.map((governorate) => (
                    <AccordionItem
                        key={governorate.id}
                        governorate={governorate}
                        isOpen={expandedId === governorate.id}
                        onToggle={() =>
                            setExpandedId((prev) => (prev === governorate.id ? null : governorate.id))
                        }
                        selectedAreaId={selectedAreaId}
                        onSelectArea={onSelectArea}
                    />
                ))
            }
        </View>
    );
};
