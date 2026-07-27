import { useRequiredAuth } from "@/context/AuthContext";
import { Stack } from "expo-router";

export default function OwnerLayout() {
    const { user } = useRequiredAuth();

    const isDraft = user.pitches.length === 1 && user.pitches[0].status === "DRAFT";
    const isSubmitted = user.pitches.length === 1 && user.pitches[0].status === "SUBMITTED";

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFF" },
                gestureEnabled: false
            }}
        >
            <Stack.Protected guard={isDraft}>
                <Stack.Screen name="draft" />
            </Stack.Protected>
            <Stack.Protected guard={isSubmitted}>
                <Stack.Screen name="submitted" />
            </Stack.Protected>
            <Stack.Screen name="(modal)" options={{ presentation: 'modal' }} />
        </Stack>
    )
}