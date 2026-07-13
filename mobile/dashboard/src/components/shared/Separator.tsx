import { View, Text } from "react-native";

export default function Separator() {
    return (
        <View className="flex-row items-center justify-center gap-x-4">
            <View className="flex-1 h-0.5 bg-gray-100"></View>
            <Text className="text-gray-400">Or</Text>
            <View className="flex-1 h-0.5 bg-gray-100"></View>
        </View>
    )
}