import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function WizardLayout() {
    const { user } = useAuth();
    const guard = !!user && user.preferences.role === "OWNER" && user.pitches.length < 1;

    return (
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
            <Stack.Protected guard={guard}>
                <Stack.Screen name="index"/>
            </Stack.Protected>
        </Stack>
    );
}