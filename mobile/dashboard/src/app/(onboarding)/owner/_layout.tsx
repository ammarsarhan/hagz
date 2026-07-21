import { HydratePitchDraft, PitchDraftFormProvider } from "@/context/forms/PitchDraftContext";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";

export default function OwnerLayout() {
    return (
        <PitchDraftFormProvider>
            <HydratePitchDraft>
                <StatusBar barStyle={"dark-content"} />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFF" } }}>
                    <Stack.Screen name="index"/>
                    <Stack.Screen name="(steps)"/>
                    <Stack.Screen name="(modal)" options={{ presentation: 'modal' }} />
                </Stack>
            </HydratePitchDraft>
        </PitchDraftFormProvider>
    )
}