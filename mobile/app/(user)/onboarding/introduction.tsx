import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Introduction() {
    return (
        <SafeAreaView className="flex-1 items-center justify-center">
            <Text>Introduction that can be skipped for users.</Text>
        </SafeAreaView>
    )
}