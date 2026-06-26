import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import { Link } from "expo-router";
import { StatusBar, View, Text, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Phone() {
    const { data, setData } = useSignUpForm();
    const isDisabled = data.phone === "";

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
                                    <Text className="text-4xl font-semibold text-center">Your phone number</Text>
                                    <Text className="text-gray-500 text-center">We&apos;ll use your number to send booking confirmations and reminders via WhatsApp.</Text>
                                </View>
                                <View className="gap-y-6 w-full">
                                    <Input 
                                        label="Phone Number" 
                                        placeholder="e.g. 1023045006" 
                                        type="phone"
                                        value={data.phone} 
                                        onChangeText={(text) => setData({ ...data, phone: text })}
                                    />
                                </View>
                                <Link asChild href={"/sign-up/password"} disabled={isDisabled}>
                                    <Button className={isDisabled ? "border-primary/40 bg-primary/40 w-full"  : "border-primary bg-primary w-full"}>
                                        <Text className="font-semibold">Next</Text>
                                    </Button>
                                </Link>
                            </View>
                        </SafeAreaView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </>
    )
}