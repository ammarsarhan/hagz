import { SignUpProvider } from '@/context/forms/SignUpContext';
import { Stack } from 'expo-router';

export default function SignUpLayout() {    
    return (
        <SignUpProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </SignUpProvider>
    )
}
