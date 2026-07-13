import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button, { ButtonProps } from "@/components/shared/Button";

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