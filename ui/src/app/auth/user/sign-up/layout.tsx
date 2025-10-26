"use client";

import { FormContextProvider } from "@/app/context/useFormContext";
import Initial, { initialSchema } from "@/app/auth/user/sign-up/steps/Initial";

export default function Layout({ children } : { children: React.ReactNode }) {
    const initial = {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: ""
    };

    const steps = [
        {
            title: "Create a new account",
            description: "Please fill in the details below to create your account.",
            component: <Initial/>,
            schema: initialSchema,
            key: "initial"
        }
    ];

    return (
        <FormContextProvider 
            initial={initial}
            steps={steps}
        >
            <div className="lg:grid grid-cols-2 h-screen p-4">
                <div className="relative h-full">
                    <div className="flex items-center justify-between h-full w-full">
                        {children}
                    </div>
                </div>
                <div className="bg-black rounded-xl">
                </div>
            </div>
        </FormContextProvider>
    )
}