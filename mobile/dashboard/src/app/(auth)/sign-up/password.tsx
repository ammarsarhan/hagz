import Animated, { FadeIn } from "react-native-reanimated";
import { Text, View } from "react-native";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";

export default function Password() {
    const { state, setField } = useSignUpForm();
    const disabled = !(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/).test(state.password);

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1 gap-y-8 px-6">
            <View className="gap-y-4">
                <Text className="text-4xl font-semibold">Secure your account</Text>
                <Text className="text-gray-500">Use a password at least 8 characters long, with one number, a lowercase and uppercase letter, and a special character.</Text>
            </View>
            <Input 
                type="password" 
                placeholder="Password" 
                label="Password" 
                textContentType="newPassword" 
                value={state.password} 
                onChangeText={(text) => setField("password", text)}
            />
            <Button className="bg-primary border-primary" disabled={disabled}>
                <Text className="text-white font-medium">Create</Text> 
            </Button>
        </Animated.View>
    )
}
