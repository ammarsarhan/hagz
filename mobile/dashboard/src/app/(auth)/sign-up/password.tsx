import { useEffect } from "react";
import { Alert, Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { client } from "@/lib/client";
import { useAuth } from "@/context/AuthContext";
import { ApiError, parseClientError } from "@/lib/error";

export default function Password() {
    const router = useRouter();
    const navigation = useNavigation();
    const { setUser, saveSession } = useAuth();
    const { state, setField } = useSignUpForm();
    
    const disabled = !(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/).test(state.password);

    const signUpMutation = useMutation({
        mutationFn: async () => {
            const phone = `+20${state.phone}`;
            const res = await client.auth["sign-up"].$post({ json: { ...state, phone } });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data;
        },
        onSuccess: async ({ user, accessToken, refreshToken }) => {
            if (accessToken && refreshToken) {
                await saveSession(user, accessToken, refreshToken);
            } else {
                // We shouldn't hit this because we're sending the request with the proper X-Client headers.
                // In case we do, just store the user.
                setUser(user);
            }

            if (user.preferences.role === "MANAGER") router.push("/(onboarding)/manager");
            if (user.preferences.role === "OWNER") router.push("/(onboarding)/owner/draft");
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                Alert.alert("Sign up failed", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    useEffect(() => {
        const unsubscribe = navigation.addListener("beforeRemove", (e) => {
            if (!signUpMutation.isPending) return;
            e.preventDefault();
        });

        return unsubscribe;
    }, [navigation, signUpMutation.isPending]);

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
            <Button className="bg-primary border-primary" onPress={() => signUpMutation.mutate()} loading={signUpMutation.isPending} disabled={disabled}>
                <Text className="text-white font-medium">Create</Text>
            </Button>
        </Animated.View>
    );
}
