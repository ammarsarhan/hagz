import { Stack } from "expo-router";

export default function PaymentsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFF" },
                gestureEnabled: false
            }}
        >
            <Stack.Screen name="index"/>  
            <Stack.Screen name="record" options={{ presentation: 'modal' }}/>  
        </Stack>
    )
}