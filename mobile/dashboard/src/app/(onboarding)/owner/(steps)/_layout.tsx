import { PitchDraftFormProvider } from "@/context/forms/PitchDraftContext";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";

export default function StepsLayout() {    
    return (
        <PitchDraftFormProvider>
            <StatusBar barStyle={"dark-content"} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#FFF" },
                }}
            >
                <Stack.Screen name="details" />
                <Stack.Screen name="location" />
                <Stack.Screen name="media" />
            </Stack>
        </PitchDraftFormProvider>
    );
}