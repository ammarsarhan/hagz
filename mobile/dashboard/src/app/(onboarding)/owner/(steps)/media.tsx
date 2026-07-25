import Footer from "@/components/onboarding/Footer";
import Header from "@/components/onboarding/Header";
import { ActivityIndicator, Alert, Image, Pressable, View, Text } from "react-native";
import { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    LinearTransition,
    useAnimatedScrollHandler,
    useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { IconPhoto, IconPhotoPlus, IconPlus, IconX } from "@tabler/icons-react-native";
import Button from "@/components/shared/Button";
import { useActionSheet } from "@expo/react-native-action-sheet";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { deletePitchMedia, uploadPitchMedia } from "@/lib/image/media";
import { ApiError } from "@/lib/error";
import { PitchMediaPresignPayload } from "@/lib/types/pitch";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { Media } from "@/lib/types/media";
import MediaScreen from "@/components/shared/MediaScreen";
import * as Crypto from "expo-crypto";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function MediaView() {
    const insets = useSafeAreaInsets();
    const scroll = useSharedValue(0);
    const { showActionSheetWithOptions } = useActionSheet();
    const { state, setState } = usePitchDraftForm();
    const { draft } = useDraftQuery();
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [preview, setPreview] = useState<string | null>(null);

    const pitchId = draft?.pitchId;

    const handleScroll = useAnimatedScrollHandler((event) => {
        scroll.value = event.contentOffset.y;
    });

    const patchMedia = (localId: string, patch: Partial<Media>) => {
        setState((prev) => ({
            ...prev,
            media: prev.media.map((item) =>
                "localId" in item && item.localId === localId ? ({ ...item, ...patch } as Media) : item
            ),
        }));
    };

    const removeLocal = (localId: string) => {
        setState((prev) => ({
            ...prev,
            media: prev.media.filter((item) => !("localId" in item && item.localId === localId)),
        }));
    };

    const uploadAsset = async (asset: ImagePicker.ImagePickerAsset, localId: string, order: number) => {
        if (!pitchId) {
            removeLocal(localId);
            Alert.alert("Upload failed", "Pitch draft not found.");
            return;
        }

        try {
            const uploaded = await uploadPitchMedia(pitchId, asset, (fraction) => {
                patchMedia(localId, { progress: fraction });
            });

            setState((prev) => ({
                ...prev,
                media: prev.media.map((item) =>
                    "localId" in item && item.localId === localId
                        ? ({ ...uploaded.media, order, state: "UPLOADED" as const })
                        : item
                ),
            }));
        } catch (e) {
            const message = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed.";
            removeLocal(localId);
            Alert.alert("Upload failed", message);
        }
    };

    // Compute the next order based on the highest existing order among all media items.
    const getNextOrder = () => {
        const orders = state.media.map((item) => {
            // Guard against missing order property.
            return "order" in item && typeof item.order === "number" ? item.order : 0;
        });
        const maxOrder = orders.length ? Math.max(...orders) : -1;
        return maxOrder + 1;
    };
    const addAsset = (asset: ImagePicker.ImagePickerAsset) => {
        const localId = Crypto.randomUUID();
        const order = getNextOrder();

        const pending: Extract<Media, { state: "UPLOADING" }> = {
            localId,
            order,
            contentType: (asset.mimeType as PitchMediaPresignPayload["contentType"]) ?? "image/jpeg",
            previewUrl: asset.uri,
            asset,
            state: "UPLOADING",
            progress: 0,
        };

        setState((prev) => ({ ...prev, media: [...prev.media, pending] }));
        uploadAsset(asset, localId, order);
    };

    const remove = async (item: Media) => {
        if (item.state !== "UPLOADED") {
            if ("localId" in item) {
                removeLocal(item.localId);
            } else {
                // Remove any placeholder or empty media entry not uploaded
                setState((prev) => ({
                    ...prev,
                    media: prev.media.filter((m) => m !== item),
                }));
            }
            return;
        }

        if (!pitchId || deletingIds.has(item.id)) return;

        setDeletingIds((prev) => new Set(prev).add(item.id));

        try {
            const success = await deletePitchMedia(pitchId, item.id);
            if (!success) throw new Error("Failed to delete photo.");

            setState((prev) => ({
                ...prev,
                media: prev.media.filter((m) => !("id" in m && m.id === item.id)),
            }));
        } catch (e) {
            const message = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to delete photo.";
            Alert.alert("Couldn't delete photo", message);
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const handleLongPressPhoto = (uri: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPreview(uri);
    };

    const handleAddPhotoSheet = () => {
        const options = ["Take a photo", "Choose from library", "Cancel"];
        const cancelButtonIndex = options.length - 1;

        showActionSheetWithOptions({ options, cancelButtonIndex }, async (selectedIndex?: number) => {
            switch (selectedIndex) {
                case 0: {
                    const permission = await ImagePicker.requestCameraPermissionsAsync();
                    if (!permission.granted) {
                        Alert.alert("Camera permission required", "Permission to access the camera is required to take a photo.");
                        return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ["images"],
                        allowsEditing: true,
                        aspect: [16, 9],
                        quality: 0.8,
                    });
                    if (!result.canceled) addAsset(result.assets[0]);
                    break;
                }
                case 1: {
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!permission.granted) {
                        Alert.alert("Photos permission required", "Permission to access photos is required to upload image.");
                        return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ["images"],
                        allowsEditing: true,
                        aspect: [16, 9],
                        quality: 0.8,
                        selectionLimit: 1,
                    });
                    if (!result.canceled) addAsset(result.assets[0]);
                    break;
                }
                case 2:
                    break;
            }
        });
    };

    const sortedMedia = [...state.media].sort((a, b) => a.order - b.order);
    const uploadedCount = state.media.filter((m) => m.state === "UPLOADED").length;

    return (
        <>
            {<MediaScreen uri={preview} setUri={setPreview} />}
            <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 bg-white">
                <KeyboardAwareScrollView
                    className="flex-1"
                    bottomOffset={120 + insets.bottom}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                >
                    <Header scroll={scroll} progress={40} />
                    <View className="px-6 flex-1 pt-3">
                        <View className="gap-y-3 mb-8">
                            <Text className="text-4xl font-semibold">Let&apos;s add some photos of your pitch!</Text>
                            <Text className="text-gray-500">
                                We&apos;ll need at least 3 high quality photos to accurately portray your venue to customers.
                            </Text>
                        </View>
                        {
                            sortedMedia.length === 0 ? (
                                <Animated.View
                                    entering={FadeIn.duration(250)}
                                    exiting={FadeOut.duration(150)}
                                    className="mb-4 h-52 items-center justify-center rounded-lg bg-gray-50 border border-gray-100"
                                >
                                    <IconPhoto color="#D1D5DB" width={40} height={40} strokeWidth={1.75} />
                                </Animated.View>
                            ) : (
                                <View className="mb-4 gap-3">
                                    {
                                        sortedMedia.map((item, index) => {
                                            const key = item.state === "UPLOADED" ? item.id : item.localId;
                                            const uri = item.state === "UPLOADED" ? item.url : item.previewUrl;
                                            const isDeleting = item.state === "UPLOADED" && deletingIds.has(item.id);

                                            return (
                                                <Animated.View
                                                    key={key}
                                                    entering={FadeInDown.duration(300).damping(18)}
                                                    exiting={FadeOut.duration(200)}
                                                    layout={LinearTransition.duration(250)}
                                                    className="h-52 w-full overflow-hidden rounded-lg bg-gray-50 border border-gray-100"
                                                >
                                                    <Pressable
                                                        onLongPress={() => handleLongPressPhoto(uri)}
                                                        delayLongPress={250}
                                                        className="flex-1"
                                                    >
                                                        <Image
                                                            source={{ uri }}
                                                            style={{ width: "100%", height: "100%" }}
                                                            resizeMode="cover"
                                                        />
                                                    </Pressable>
                                                    {
                                                        item.state === "UPLOADING" && (
                                                            <Animated.View
                                                                entering={FadeIn.duration(150)}
                                                                exiting={FadeOut.duration(150)}
                                                                className="absolute inset-0 items-center justify-center bg-black/40"
                                                            >
                                                                <Text className="text-white text-sm font-medium">
                                                                    {Math.round(item.progress * 100)}%
                                                                </Text>
                                                            </Animated.View>
                                                        )
                                                    }
                                                    {
                                                        isDeleting && (
                                                            <Animated.View
                                                                entering={FadeIn.duration(150)}
                                                                exiting={FadeOut.duration(150)}
                                                                className="absolute inset-0 items-center justify-center bg-black/40"
                                                            >
                                                                <ActivityIndicator size="small" color="#FFF" />
                                                            </Animated.View>
                                                        )
                                                    }
                                                    <Pressable
                                                        onPress={() => remove(item)}
                                                        disabled={isDeleting}
                                                        className="absolute top-3 right-3 h-6 w-6 items-center justify-center rounded-full bg-black/50"
                                                    >
                                                        <IconX width={14} height={14} color="#FFF" />
                                                    </Pressable>
                                                </Animated.View>
                                            );
                                        })
                                    }
                                </View>
                            )
                        }
                        {
                            uploadedCount < 1 &&
                            <Animated.View layout={LinearTransition.duration(250)} entering={FadeIn.duration(100)} exiting={FadeOut.duration(100)}>
                                <Button className="bg-primary border-primary" onPress={handleAddPhotoSheet}>
                                    <IconPlus color="#FFFFFF" width={18} height={18} />
                                    <Text className="text-center text-white font-medium">Add photo</Text>
                                </Button>
                            </Animated.View>
                        }
                    </View>
                </KeyboardAwareScrollView>
                <Footer disabled={uploadedCount < 3} href={"/(onboarding)/owner/(steps)/amenities"}>
                {
                    uploadedCount >= 1 &&
                    <AnimatedPressable 
                        entering={FadeIn.duration(100)} 
                        exiting={FadeOut.duration(100)}
                        className="size-16 items-center justify-center rounded-full bg-primary" 
                        onPress={handleAddPhotoSheet}
                        onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
                    >
                        <IconPhotoPlus size={22} color="#FFF"/>
                    </AnimatedPressable>
                }
                </Footer>
            </Animated.View>
        </>
    );
};
