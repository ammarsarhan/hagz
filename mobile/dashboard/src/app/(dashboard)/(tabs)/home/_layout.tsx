import { Stack } from "expo-router";

export default function HomeLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFF" },
                gestureEnabled: false
            }}
        >
            <Stack.Screen name="index"/>  
            <Stack.Screen name="notifications" options={{ presentation: 'modal' }}/>  
        </Stack>
    )
}