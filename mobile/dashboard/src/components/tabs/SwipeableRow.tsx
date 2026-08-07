import { IconTrash } from "@tabler/icons-react-native";
import { Pressable, View } from "react-native";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useEffect } from "react";

type SwipeableRowProps = {
    children: React.ReactNode;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onDelete: () => void;
};

export default function SwipeableRow({
    children,
    isOpen,
    onOpen,
    onClose,
    onDelete,
}: SwipeableRowProps) {
    const translateX = useSharedValue(0);

    useEffect(() => {
        translateX.value = withSpring(isOpen ? -72 : 0);
    }, [isOpen, translateX]);

    const gesture = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
            const startX = isOpen ? -72 : 0;
            const nextX = startX + event.translationX;
            translateX.value = Math.max(-72, Math.min(0, nextX));
        })
        .onEnd(() => {
            if (translateX.value < -36) {
                translateX.value = withSpring(-72);
                runOnJS(onOpen)();
            } else {
                translateX.value = withSpring(0);
                runOnJS(onClose)();
            }
        });

    const rowStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const handleDelete = () => {
        translateX.value = withSpring(0);
        onClose();
        onDelete();
    };

    return (
        <View className="overflow-hidden">
            <View className="absolute inset-y-0 right-0 w-[72px] bg-red-600">
                <Pressable onPress={handleDelete} className="flex-1 items-center justify-center">
                    <IconTrash width={20} height={20} color="#FFFFFF" strokeWidth={2.25} />
                </Pressable>
            </View>
            <GestureDetector gesture={gesture}>
                <Animated.View style={rowStyle}>{children}</Animated.View>
            </GestureDetector>
        {
            isOpen && 
                <Pressable
                    className="absolute inset-y-0 left-0"
                    style={{ right: 72 }}
                    onPress={onClose}
                />
        }
        </View>
    );
};
