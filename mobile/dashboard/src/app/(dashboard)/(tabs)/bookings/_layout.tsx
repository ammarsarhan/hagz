import { Stack } from "expo-router";

export default function BookingsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFF" },
                gestureEnabled: false
            }}
        >
            <Stack.Screen name="index"/>  
            <Stack.Screen name="modal" options={{ presentation: 'modal' }}/>  
        </Stack>
    )
}