import { Pressable, View, Text, ScrollView } from "react-native";
import ProfilePicture from "@/components/onboarding/ProfilePicture";
import { handleUploadAvatar } from "@/lib/image";
import * as ImagePicker from 'expo-image-picker';
import Input from "@/components/shared/Input";
import { useAuth } from "@/context/AuthContext";
import { IconBell, IconChevronLeft, IconChevronRight, IconLanguage, IconLogout, IconTimezone, IconUserCog } from "@tabler/icons-react-native";
import { Link, router } from "expo-router";

export default function Index() {
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
    };
    
    return (
        <ScrollView className="p-6">
            <View className="mb-3">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={() => router.back()}>
                    <IconChevronLeft size={18}/>
                </Pressable>
            </View>
            <View className="gap-y-1 py-2 mb-10">
                <Text className="text-3xl font-semibold">Profile</Text> 
                <Text className="text-gray-500">Manage your account settings and preferences</Text> 
            </View>
            <View className="gap-y-4 mb-12 items-center justify-center">
                <ProfilePicture /> 
                <Pressable onPress={selectAvatar} className="rounded-lg border border-gray-500 px-4 py-3 items-center justify-center">
                    <Text className="text-sm font-medium">{user.avatarUrl ? "Change photo" : "Upload photo"}</Text>
                </Pressable>
            </View>
            <View className="gap-y-6 mb-6">
                <View className="flex-row gap-x-4">
                    <Input label="First Name" placeholder="First Name" containerClassName="flex-1"/>
                    <Input label="Last Name" placeholder="Last Name" containerClassName="flex-1"/>
                </View>
                <View className="gap-y-2">
                    <Input type="phone" label="Phone" placeholder="e.g. 1023045006"/>
                    <Text className="text-gray-500 text-sm">You will be required to re-verify your phone number if modified.</Text>
                </View>
                <Input label="Email" placeholder="Email Address"/>
            </View>
            <View className="mb-12">
                <Link asChild href="/(onboarding)/owner/(modal)/language">
                    <Pressable className="flex-row items-center gap-x-5 border-b border-gray-100 py-5 px-2">
                        <IconLanguage width={22} height={22}/>
                        <View className="flex-1">
                            <Text className="font-medium">Language</Text> 
                            <Text className="text-gray-500 text-sm">Manage your application display preferences.</Text> 
                        </View>
                        <IconChevronRight width={18} height={18} color="#6B7280"/>
                    </Pressable>
                </Link>
                <Link asChild href="/(onboarding)/owner/(modal)/notifications">  
                    <Pressable className="flex-row items-center gap-x-4 border-b border-gray-100 py-5 px-2">
                        <IconBell width={22} height={22}/>
                        <View className="flex-1">
                            <Text className="font-medium">Notifications</Text> 
                            <Text className="text-gray-500 text-sm">Select your notification delivery channels.</Text> 
                        </View>
                        <IconChevronRight width={18} height={18} color="#6B7280"/>
                    </Pressable>
                </Link>
                <View className="flex-row items-center gap-x-4 border-b border-gray-100 py-5 px-2">
                    <IconTimezone width={22} height={22}/>
                    <View className="flex-1">
                        <Text className="font-medium">Timezone</Text> 
                    </View>
                    <Text className="text-gray-500">{user.preferences.timezone}</Text>
                </View>
                <Link href={"/(onboarding)/owner/(modal)/transfer"} asChild>
                    <Pressable className="flex-row items-center gap-x-4 border-b border-gray-100 py-5 px-2">
                        <IconUserCog width={22} height={22}/>
                        <View className="flex-1">
                            <Text className="font-medium">Transfer</Text> 
                            <Text className="text-gray-500 text-sm">Change your account to a manager or owner account.</Text> 
                        </View>
                        <IconChevronRight width={18} height={18} color="#6B7280"/>
                    </Pressable>
                </Link>
            </View>
        </ScrollView>
    )
}