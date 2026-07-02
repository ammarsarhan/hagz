import { useAuth } from "@/context/AuthContext";
import { View, Text } from "react-native";

export default function Avatar() {
    const { user } = useAuth();
    
    if (user) {
        return (
            <View className='bg-gray-200 items-center justify-center rounded-full size-10'>
                <Text className="font-medium text-lg">{user.firstName[0].toUpperCase()}</Text>
            </View>
        )
    }

    return null;
}