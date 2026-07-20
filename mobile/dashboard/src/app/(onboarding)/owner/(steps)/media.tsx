import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from 'expo-image-picker';
import { IconPhotoUp, IconUpload } from "@tabler/icons-react-native";
import Button from "@/components/shared/Button";

export default function Location() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    const selectPitchMedia = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (!permission.granted) {
            alert("Permission to access photos is required to upload image.");
            return;
        };

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            selectionLimit: 1
        });

        if (!result.canceled) {

        }
    };

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 bg-white">
            <KeyboardAwareScrollView
                className="flex-1"
                bottomOffset={100 + insets.bottom}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
            >
                <Header scroll={scroll} progress={15} />
                <View className="px-6 flex-1 pt-3">
                    <View className="gap-y-3 mb-12">
                        <Text className="text-4xl font-semibold">Let&apos;s add some photos of your pitch!</Text>
                        <Text className="text-gray-500">We&apos;ll need at least 3 high quality photos to accurately portray your venue to customers.</Text>
                    </View>
                    <View className="min-h-56 gap-y-3 items-center justify-center rounded-lg border border-dashed border-gray-300">
                        <IconPhotoUp width={32} height={32} color="#4B5563" />
                        <Text className="font-medium text-lg text-gray-600">Add at least 3 photos</Text>
                        <Pressable onPress={selectPitchMedia}>
                            <Text className="text-primary">Upload photo</Text>  
                        </Pressable>
                    </View>
                </View>
            </KeyboardAwareScrollView>
            <Footer disabled={false} href={"/(onboarding)/owner/(steps)/media"}/>
        </Animated.View>
    );
}
