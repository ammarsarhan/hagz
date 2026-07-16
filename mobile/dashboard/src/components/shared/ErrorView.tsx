import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button, { ButtonProps } from "@/components/shared/Button";
import { router } from "expo-router";
import Icon from "@/assets/base/cropped.svg";

interface ErrorViewProps {
    title: string;
    description?: string;
    actionProps: ButtonProps;
}

export default function ErrorView({ title, description, actionProps } : ErrorViewProps) {
    return (
        <>
            <StatusBar barStyle={'dark-content'} />
            <SafeAreaView className="flex-1 gap-y-6 items-center justify-center p-6 bg-white">
                <View className="flex-row items-center w-full gap-x-2">
                    <Icon width={30} height={30} color={"#000000"}/>
                    <Text className="text-black font-semibold">Dashboard</Text>
                </View>
                <View className="gap-y-4 mb-2">
                    <Text className="text-4xl font-semibold">{title}</Text>
                    {description && <Text className="text-gray-500">{description}</Text>}
                </View>
                <View className="w-full">
                    <Button {...actionProps}/>
                </View>
            </SafeAreaView>
        </>
    )
}

export function createErrorBoundary() {
    return function RootErrorBoundary() {
        return (
            <ErrorView 
                title="An unexpected error has occurred." 
                description="If this error keeps persisting, please get in touch with customer support as soon as possible." 
                actionProps={{
                    className: "bg-primary border-primary",
                    onPress: () => router.push("/(auth)/sign-in"),
                    children: <Text className="font-medium text-white">Go back</Text>
                }} 
            />
        );
    };
}