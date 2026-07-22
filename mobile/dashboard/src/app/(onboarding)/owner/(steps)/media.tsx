import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from 'expo-image-picker';
import { IconPhoto, IconPlus } from "@tabler/icons-react-native";
import Button from "@/components/shared/Button";
import { useActionSheet } from "@expo/react-native-action-sheet";

export default function Location() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);
    const { showActionSheetWithOptions } = useActionSheet();

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    const handleAddPhotoSheet = () => {
        const options = ['Take a photo', 'Choose from library', 'Cancel'];
        const cancelButtonIndex = options.length - 1;

        showActionSheetWithOptions({ options, cancelButtonIndex }, async (selectedIndex?: number) => {
            switch (selectedIndex) {
                case 0:
                    {
                        const permission = await ImagePicker.requestCameraPermissionsAsync();

                        if (!permission.granted) {
                            alert("Permission to access the camera is required to take a photo.");
                            return;
                        }

                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ["images"],
                            allowsEditing: true,
                            aspect: [9, 16],
                            quality: 0.8,
                        });

                        if (!result.canceled) {

                        };

                        break;
                    }
                case 1:
                    {
                        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
                        if (!permission.granted) {
                            alert("Permission to access photos is required to upload image.");
                            return;
                        };

                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ["images"],
                            allowsEditing: true,
                            aspect: [9, 16],
                            quality: 0.8,
                            selectionLimit: 1
                        });

                        if (!result.canceled) {

                        };

                        break;
                    }

                case 2:
                    {
                        break;
                    }
            }
        });
    };

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 bg-white">
            <KeyboardAwareScrollView
                className="flex-1"
                bottomOffset={120 + insets.bottom}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
            >
                <Header scroll={scroll} progress={40}/>
                <View className="px-6 flex-1 pt-3">
                    <View className="gap-y-3 mb-8">
                        <Text className="text-4xl font-semibold">Let&apos;s add some photos of your pitch!</Text>
                        <Text className="text-gray-500">We&apos;ll need at least 3 high quality photos to accurately portray your venue to customers.</Text>
                    </View>
                    <View className="mb-4 h-52 items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
                        <IconPhoto color="#D1D5DB" width={40} height={40} strokeWidth={1.75} />
                    </View>
                    <Button className="bg-primary border-primary" onPress={handleAddPhotoSheet}>  
                        <IconPlus color="#FFFFFF" width={18} height={18} />
                        <Text className="text-center text-white font-medium">Add photo</Text>
                    </Button>
                </View>
            </KeyboardAwareScrollView>
            <Footer disabled={true} href={"/(onboarding)/owner/(steps)/amenities"}/>
        </Animated.View>
    );
}
