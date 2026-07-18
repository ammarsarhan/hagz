import { useRequiredAuth } from "@/context/AuthContext";
import { View, Text} from "react-native";
import { Image } from 'expo-image';

export default function Avatar() {
    const { user } = useRequiredAuth();

    return (
        <View className="bg-gray-100 size-12 rounded-full items-center justify-center">
            {
                user.avatarUrl ?
                <Image
                    source={{ uri: user.avatarUrl }}
                    style={{ width: '100%', height: '100%', borderRadius: 9999 }}
                    contentFit="cover"
                /> :
                <Text className="font-medium text-lg">{user.firstName[0].toUpperCase()}</Text>
            }
        </View>
    )
}