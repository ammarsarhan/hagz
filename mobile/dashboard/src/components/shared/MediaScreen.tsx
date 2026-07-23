import { useEffect, useState } from "react";
import { Modal, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut, runOnJS } from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconX } from "@tabler/icons-react-native";

export default function MediaScreen({ uri, setUri }: { uri: string | null; setUri: (uri: string | null) => void }) {
    const insets = useSafeAreaInsets();

    const [contentUri, setContentUri] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        if (uri) {
            setContentUri(uri);
            setModalVisible(true);
        } else {
            setContentUri(null);
        }
    }, [uri]);

    return (
        <Modal
            visible={modalVisible}
            transparent
            statusBarTranslucent
            animationType="none"
            onRequestClose={() => setUri(null)}
        >
            {
                contentUri && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150).withCallback((finished) => {
                            "worklet";
                            if (finished) runOnJS(setModalVisible)(false);
                        })}
                        className="flex-1 bg-black"
                    >
                        <Pressable
                            onPress={() => setUri(null)}
                            className="flex-1 items-center justify-center"
                        >
                            <Image
                                source={{ uri: contentUri }}
                                style={{ width: "100%", height: "100%" }}
                                contentFit="contain"
                            />
                        </Pressable>
                        <Pressable
                            onPress={() => setUri(null)}
                            style={{ top: insets.top + 12 }}
                            className="absolute right-5 h-10 w-10 items-center justify-center rounded-full bg-black/50"
                        >
                            <IconX width={20} height={20} color="#FFF" />
                        </Pressable>
                    </Animated.View>
                )
            }
        </Modal>
    );
}
