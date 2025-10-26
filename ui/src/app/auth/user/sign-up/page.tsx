/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import useFormContext from "@/app/context/useFormContext";
import { useRouter } from "next/navigation";

export default function SignUp() {
    const router = useRouter();
    const { setIsLoading, currentStep, formData, setError, error, isLast } = useFormContext();

    // Asynchronous wrapper to send data with fetch API.
    const submitForm = async (form: any) => {
        setIsLoading(true);
        
        const targetURL = `${process.env.NEXT_PUBLIC_API_URL}/auth/sign-up`;

        // Send the form data along with the role the user is signing up for.
        const body = {
            ...form,
            role: "USER"
        };

        const res = await fetch(targetURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            credentials: "include"
        });
        
        const data = await res.json();

        // If the user account has not been created, display the error message and stop loading.
        if (!res.ok) {
            setError(data.message);
            setIsLoading(false);
            return;
        };

        // If the user account has been created, go to the verification section.
        router.push('/auth/verify/send');
    };

    // handleSubmit will be a global function to across all form currentSteps that will:
    // 1) Prevent the default action for the form element
    // 2) Check if a schema exists and validate the data against it.
    // 3) Clean up the object from unused fields
    // 4) Submit the data to the specified endpoint URL on the final step.

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const currentSchema = currentStep.schema;

        if (currentSchema) {
            const parsed = currentSchema.safeParse(formData);
            
            if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
            }
        };

        if (isLast) {
            function removeEmptyStrings<T extends Record<string, any>>(obj: T): Partial<T> {
                return Object.fromEntries(
                    Object.entries(obj).filter(([_, value]) => value !== "")
                ) as Partial<T>;
            }

            const data = removeEmptyStrings(formData);
            submitForm(data);
        };
    };

    return (
        <div className="w-full px-4 sm:px-16 text-sm [@media(max-height:700px)]:text-xs max-w-2xl mx-auto">
            <p className="text-red-500 my-4">{error}</p>
            <div>
                <h1 className="text-2xl font-semibold mb-1">{currentStep.title}</h1>
                <span className="text-gray-600">{currentStep.description}</span>
            </div>
            <form onSubmit={handleSubmit}>
                {currentStep.component}
            </form>
        </div>
    )
}