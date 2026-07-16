import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { client } from "@/lib/client";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage, parseClientError } from "@/lib/error";

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
        
        try {
            const phone = `+20${state.phone}`;
            const res = await client.auth["sign-up"].$post({ json: {...state, phone } });
    
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
    
                if (user.preferences.role === "MANAGER") router.push("/(onboarding)/manager");
                if (user.preferences.role === "OWNER") router.push("/(onboarding)/owner");
                return;
            };
    
            const error = await parseClientError(res);
            let message = error.message;
    
            if (error.fields?.length) {
                message = error.fields.map(f => f.message).join("\n");
            }
    
           message = getErrorMessage(error);
           Alert.alert("Sign up failed", message);
        } catch (error) {
            console.log(error);
            Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
        } finally {
            setLoading(false);
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
