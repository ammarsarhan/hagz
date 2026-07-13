import Animated, { FadeIn } from "react-native-reanimated";
import { Keyboard, Text, View } from 'react-native';
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { Link } from "expo-router";
import { useSignUpForm } from "@/context/forms/SignUpContext";

export default function Name() {
    const { state, setField } = useSignUpForm();
    const disabled = state.firstName.length <= 1 || state.lastName.length <= 1;

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 px-6 gap-y-8">
            <View className="gap-y-4">
                <Text className="text-4xl font-semibold">What should we call you?</Text>
                <Text className="text-gray-500">Use your first and last name as issued on your National ID or any official document you can provide as proof of identity.</Text>
            </View>
            <View className="gap-y-4">
                <Input placeholder="First Name" value={state.firstName} onChangeText={(text) => setField("firstName", text)} />
                <Input placeholder="Last Name" value={state.lastName} onChangeText={(text) => setField("lastName", text)} />
            </View>
            <Link asChild href="/(auth)/sign-up/password" onPress={Keyboard.dismiss}>
                <Button className="bg-primary border-primary" disabled={disabled}>
                    <Text className="text-white font-medium">Next</Text>
                </Button>
            </Link>
        </Animated.View>
    )
}