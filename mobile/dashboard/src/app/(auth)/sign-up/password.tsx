import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { client } from "@/lib/client";
import { useAuth } from "@/context/AuthContext";

export default function Password() {
    const router = useRouter();
    const navigation = useNavigation();
    const { setUser, saveSession } = useAuth();

    const { state, setField } = useSignUpForm();
    const [loading, setLoading] = useState(false);
    const disabled = !(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/).test(state.password);

    useEffect(() => {
        const unsubscribe = navigation.addListener("beforeRemove", (e) => {
            if (!loading) return;
            e.preventDefault();
        });

        return unsubscribe;
    }, [navigation, loading]);

    const handleSubmit = async () => {
        setLoading(true);
        const res = await client.auth["sign-up"].$post({ json: state });

        if (res.ok) {
            const { data } = await res.json();
            const { user, accessToken, refreshToken } = data;

            if (accessToken && refreshToken) {
                saveSession(user, accessToken, refreshToken);
            } else {
                // We shouldn't hit this because we're sending the request with the proper X-Client headers.
                // In case we do, just store the user.
                setUser(user);
            };

            router.push("/")
        };
    };

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
            <Button className="bg-primary border-primary" onPress={handleSubmit} loading={loading} disabled={disabled}>
                <Text className="text-white font-medium">Create</Text> 
            </Button>
        </Animated.View>
    )
}
