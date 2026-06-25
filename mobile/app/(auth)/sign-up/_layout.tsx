import { FormContextProvider } from '@/context/FormContext';
import { Stack } from 'expo-router';

export default function SignUpLayout() {
    const initial = {
        firstName: "",
        lastName: "",
        role: "USER",
        phone: "",
        password: "",
        confirmPassword: "",
    };
    
    return (
        <FormContextProvider initial={initial}>
            <Stack screenOptions={{ headerShown: false }} />
        </FormContextProvider>
    )
}
