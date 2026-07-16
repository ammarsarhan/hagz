import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button, { ButtonProps } from "@/components/shared/Button";
import { router } from "expo-router";

interface ErrorViewProps {
    title: string;
    description?: string;
    actionProps: ButtonProps;
}

export default function ErrorView({ title, description, actionProps } : ErrorViewProps) {
    return (
        <SafeAreaView className="flex-1 items-center justify-center">
            <View className="gap-y-4">
                <Text className="text-4xl text-center font-semibold">{title}</Text>
                {description && <Text className="text-gray-500">{description}</Text>}
                <Button {...actionProps}/>
            </View>
        </SafeAreaView>
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