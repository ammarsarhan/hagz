"use client";

import { FormEvent } from "react"
import { InputGroup, InputGroupContainer } from "@/components/input";

export default function Signup() {
    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
    }

    return (
        <div className="grid grid-cols-2 h-screen">
            <form className="flex-center flex-col gap-y-10 h-full border-r-[1px] px-6" onSubmit={onSubmit}>
                <div className="text-center">
                    <h1 className="text-2xl mb-1">Create A New Account</h1>
                    <p className="text-sm text-gray-500">Create a new account to start reserving with Hagz!</p>
                </div>
                <div className="flex-center flex-col gap-y-5 w-full">
                    <InputGroupContainer>
                        <InputGroup label="First Name" placeholder="First Name"/>
                        <InputGroup label="Last Name" placeholder="Last Name"/>
                    </InputGroupContainer>
                    <InputGroup label="Email Address" placeholder="Email"/>
                    <InputGroup label="Phone Number" placeholder="Phone (xxxx-xxx-xxxx)"/>
                </div>
            </form>
            <div className="h-full"></div>
        </div>
    )
}