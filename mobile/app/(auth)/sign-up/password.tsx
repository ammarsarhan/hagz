import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StatusBar, View, Text, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Password() {
    const { data, setData } = useSignUpForm();
    const isDisabled = data.password === "" || data.confirmPassword === "" || data.password !== data.confirmPassword;

    useFocusEffect(
        useCallback(() => {
            return () => Keyboard.dismiss();
        }, [])
    );

    return (
        <>
            <StatusBar barStyle='dark-content'/>
            <KeyboardAvoidingView
                className="flex-1 overflow-hidden"
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View className="flex-1 bg-white w-full">
                        <SafeAreaView className="flex-1 items-center justify-center  p-6 w-full">
                            <View className="gap-y-10 w-full">
                                <View className="gap-y-3">
                                    <Text className="text-4xl font-semibold text-center">Secure your account</Text>
                                    <Text className="text-gray-500 text-center">Make sure your password has at least one lowercase and uppercase character, a number, and a special character.</Text>
                                </View>
                                <View className="gap-y-6 w-full">
                                    <Input 
                                        label="Password" 
                                        placeholder="Min. 8 characters" 
                                        type="password"
                                        textContentType="newPassword"
                                        value={data.password} 
                                        onChangeText={(text) => setData({ ...data, password: text })}
                                    />
                                    <Input 
                                        label="Confirm Password" 
                                        placeholder="Re-enter password" 
                                        type="password"
                                        textContentType="newPassword"
                                        value={data.confirmPassword} 
                                        onChangeText={(text) => setData({ ...data, confirmPassword: text })}
                                    />
                                </View>
                                <Button className={isDisabled ? "border-gray-200 bg-gray-200 w-full" : "border-primary bg-primary w-full"}>
                                    <Text className={`font-semibold ${isDisabled ? "text-gray-400" : "text-black"}`}>Create Account</Text>
                                </Button>
                            </View>
                        </SafeAreaView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </>
    )
}