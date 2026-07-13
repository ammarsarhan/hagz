import { useAuth } from "@/context/AuthContext";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { Modal, View, Text, Pressable } from "react-native";
import ProfilePicture from "@/components/onboarding/ProfilePicture";
import * as ImagePicker from 'expo-image-picker';
import { handleUploadAvatar } from "@/lib/image";

export default function ProfileModal({ isOpen, onClose } : { isOpen: boolean, onClose: () => void }) {
    const { user, setUser } = useAuth();
    
    if (!user) return null;

    const selectAvatar = async () => {
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
            const updated = await handleUploadAvatar(result.assets[0]);
            if (updated) setUser(updated);
        }
    }

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            allowSwipeDismissal
            onRequestClose={onClose}
        >
            <View className="flex-1 gap-y-10 p-6">
                <View className="gap-y-1 py-2">
                    <View className="mb-3">
                        <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={onClose}>
                            <IconChevronLeft size={18}/>
                        </Pressable>
                    </View>
                    <Text className="text-3xl font-semibold">Profile</Text> 
                    <Text className="text-gray-500">Manage your account settings and preferences</Text> 
                </View>
                <View className="gap-y-4 items-center justify-center">
                    <ProfilePicture /> 
                    <Pressable onPress={selectAvatar} className="rounded-lg border border-gray-500 px-4 py-3 items-center justify-center">
                        <Text className="text-sm font-medium">{user.avatarUrl ? "Change photo" : "Upload photo"}</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    )
}