import { Keyboard, Text } from 'react-native';
import { Link } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { useSignUpForm } from "@/context/forms/SignUpContext";

export default function Phone() {
    const { state, setField } = useSignUpForm();

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 gap-y-8 px-6">
            <Text className="text-4xl font-semibold">What is your phone number?</Text>
            <Input type="phone" placeholder="e.g. 1023045006" label="Phone Number" value={state.phone} onChangeText={(text) => setField("phone", text)}/>
            <Text className="text-sm text-gray-500">Use your 10-digit Egyptian mobile number, excluding the initial zero. Example: 01023045006 becomes 1023045006.</Text>
            <Link asChild href="/(auth)/sign-up/name" onPress={Keyboard.dismiss}>    
                <Button className="bg-primary border-primary" disabled={state.phone.length !== 10}>
                    <Text className="text-white font-medium">Next</Text> 
                </Button>
            </Link>
        </Animated.View>
    )
}