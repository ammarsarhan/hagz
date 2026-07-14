import { useRequiredAuth } from "@/context/AuthContext";
import { IconPlus } from "@tabler/icons-react-native";
import { View } from "react-native";
import { Image } from 'expo-image';

export default function ProfilePicture() {
    const { user } = useRequiredAuth();

    return (
        <View className="size-28 rounded-full bg-gray-100 items-center justify-center">
            {
                user.avatarUrl ?
                <Image
                    source={{ uri: user.avatarUrl }}
                    style={{ width: '100%', height: '100%', borderRadius: 9999 }}
                    contentFit="cover"
                /> :
                <IconPlus />
            }
        </View>
    )
}