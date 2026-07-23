import { Modal, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconX } from "@tabler/icons-react-native";

export default function MediaScreen({ uri, setUri } : { uri: string | null, setUri: (uri: string | null) => void }) {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={uri !== null}
            transparent
            statusBarTranslucent
            animationType="none"
            onRequestClose={() => setUri(null)}
        >
            {
                uri && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                        className="flex-1 bg-black"
                    >
                        <Pressable
                            onPress={() => setUri(null)}
                            className="flex-1 items-center justify-center"
                        >
                            <Image
                                source={{ uri: uri }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="contain"
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
    )
}