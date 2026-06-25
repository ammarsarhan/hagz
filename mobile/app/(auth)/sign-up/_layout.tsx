import { FormContextProvider } from '@/context/FormContext';
import { Stack } from 'expo-router';

import Name from '@/app/(auth)/sign-up/views/Name';
import Role from '@/app/(auth)/sign-up/views/Role';
import Phone from '@/app/(auth)/sign-up/views/Phone';
import Password from '@/app/(auth)/sign-up/views/Password';

export default function SignUpLayout() {
    const initial = {
        firstName: "",
        lastName: "",
        role: "USER",
        phone: "",
        password: "",
        confirmPassword: "",
    };
    
    const steps = [<Name key={0}/>, <Role key={1}/>, <Phone key={2}/>, <Password key={3}/>];

    return (
        <FormContextProvider steps={steps} initial={initial}>
            <Stack screenOptions={{ headerShown: false }} />
        </FormContextProvider>
    )
}
