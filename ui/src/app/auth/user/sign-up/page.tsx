"use client";

import { FormEvent } from "react"
import { InputGroup } from "@/components/input";

export default function Signup() {
    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
    }

    return (
        <div className="grid grid-cols-2 h-screen">
            <form className="flex-center flex-col gap-y-4 h-full border-r-[1px]" onSubmit={onSubmit}>
                <div className="text-center">
                    <h1 className="text-2xl mb-1">Create A New Account</h1>
                    <p className="text-sm text-gray-500">Create a new account to start reserving with Hagz!</p>
                </div>
                <InputGroup label="omak" placeholder="omak"/>
            </form>
            <div className="h-full"></div>
        </div>
    )
}