import { Stack } from "expo-router";
import { StatusBar } from "react-native";

export default function StepsLayout() {    
    return (
        <>
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
                <Stack.Screen name="amenities" />
                <Stack.Screen name="grounds" />
            </Stack>
        </>
    );
}