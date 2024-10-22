"use client"

import useMultistepForm from "@/hooks/useMultistepForm";

export default function SignIn () {
    const { currentStepIndex, step, steps, traverse, next, back } = useMultistepForm([]);
    return (
        <div>
            Sign In
            {step}
        </div>
    )
}