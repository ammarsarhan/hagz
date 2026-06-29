import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from 'react-native';
import { useAuth } from "@/context/AuthContext";
import { IconAdjustmentsSpark } from "@tabler/icons-react-native";
import Button from "@/components/shared/Button";

export default function Personalize() {
    const { user } = useAuth();

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1 items-center justify-center p-6 gap-y-10">
                <View className="gap-y-3 items-center justify-center">
                    <IconAdjustmentsSpark size={64} fill={"#FFF"}/>
                    <Text className="text-4xl text-center font-semibold">Welcome, {user?.firstName}!</Text>
                    <Text className="text-gray-500 text-center">Help us personalize your experience in under a minute.</Text>
                </View>
                <View className="w-full gap-y-2">
                    <Button className="border-primary bg-primary">
                        <Text className="font-semibold">Get Started</Text>
                    </Button>
                    <View className="flex-row items-center gap-x-8 px-4 py-3">
                        <View className="h-0.5 flex-1 rounded-full bg-gray-100"></View>
                        <Text className="text-center text-sm text-gray-500">Or</Text>
                        <View className="h-0.5 flex-1 rounded-full bg-gray-100"></View>
                    </View>
                    <Button className="bg-card-foreground mb-3">
                        <Text className="font-semibold text-card">Skip & Explore</Text>
                    </Button>
                    <View className="items-center">
                        <Text className="text-sm text-center text-gray-500 w-3/4">You can always change this later from your account settings.</Text>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    )
}