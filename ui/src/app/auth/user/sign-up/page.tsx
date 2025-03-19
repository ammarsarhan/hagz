"use client";

import { FormEvent, useCallback, useEffect } from "react"
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

const Third = () => {
    const sendEmail = useCallback(async (email: string) => {
        const res = await fetch('http://127.0.0.1:3000/api/auth/user/verify/send', {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-type": "application/json"
            },
            body: JSON.stringify({ email: email })
        });

        const data = await res.json();
        console.log(data);
        return data;
    }, []);

    useEffect(() => {
        sendEmail("something");
    }, [sendEmail]);

    return (
        <>
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
        {
            label: "Verify Your Account",
            description: "An email has been sent to the provided email address. Please follow the link sent to complete your sign up.",
            component: <Third/>
        },
    ];

    const { step, index, previous, next } = useMultistepForm(steps);

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
    }

    return (
        <div className="grid grid-cols-2 h-screen">
            <form className="flex-center flex-col gap-y-12 h-full border-r-[1px] px-8" onSubmit={onSubmit}>
                <div className="flex-center flex-col text-center">
                    <h1 className="text-2xl mb-2">{step.label}</h1>
                    <p className="text-sm text-gray-500 w-4/5">{step.description}</p>
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