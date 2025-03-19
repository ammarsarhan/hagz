"use client";

import { FormEvent } from "react"
import { InputGroup, InputGroupContainer } from "@/components/input";
import Button from "@/components/button";
import useMultistepForm from "./hook";

const First = () => {
    return (
        <>
            <InputGroupContainer>
                <InputGroup label="First Name" placeholder="First Name"/>
                <InputGroup label="Last Name" placeholder="Last Name"/>
            </InputGroupContainer>
            <InputGroup label="Email Address" placeholder="Email"/>
            <InputGroup label="Phone Number" placeholder="Phone (xxxx-xxx-xxxx)"/>
        </>
    )
};

const Second = () => {
    return (
        <>
            <InputGroup label="Password" placeholder="Password"/>
            <InputGroup label="Confirm Password" placeholder="Re-enter Password"/>  
        </>
    )
}

export default function Signup() {
    const steps = [
        {
            label: "Create A New Account",
            description: "Create a new account to start reserving with Hagz!",
            component: <First/>
        },
        {
            label: "Secure Your Account",
            description: "Choose a password to secure your account. Password must be at least 8 characters and contain a combination of characters and letters.",
            component: <Second/>
        },
    ];

    const { step, index, previous, next } = useMultistepForm(steps);

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
    }

    return (
        <div className="grid grid-cols-2 h-screen">
            <form className="flex-center flex-col gap-y-12 h-full border-r-[1px] px-8" onSubmit={onSubmit}>
                <div className="text-center">
                    <h1 className="text-2xl mb-1">{step.label}</h1>
                    <p className="text-sm text-gray-500">{step.description}</p>
                </div>
                <div className="flex-center flex-col gap-y-5 w-full">
                    {step.component}
                </div>
                <div className="flex items-center justify-center gap-x-6 w-full">
                    {
                        index != 0 &&
                        <Button className="w-1/3 py-3 rounded-lg text-sm" variant="outline" onClick={previous}>
                            Previous
                        </Button>
                    }
                    {
                        index <= steps.length &&
                        <Button className="w-1/3 py-3 rounded-lg text-sm" onClick={next}>
                            Next
                        </Button>
                    }
                </div>
            </form>
            <div className="h-full"></div>
        </div>
    )
}