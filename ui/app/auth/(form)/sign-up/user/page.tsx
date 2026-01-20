"use client";

import Link from "next/link";

import Button from "@/app/components/base/Button";
import Logo from "@/app/components/base/Logo";
import { InputGroup } from "@/app/components/base/Input";

import { FaArrowLeft } from "react-icons/fa6";
import { useReducer, useState } from "react";

interface CreateUserPayload {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
}

interface CreateUserAction {
  field: keyof CreateUserPayload
  value: string
}

function createUserReducer(state: CreateUserPayload, action: CreateUserAction) {
    return {
        ...state,
        [action.field]: action.value,
    };
};

export default function SignUp() {
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Array<Record<string, string>>>([]);

    const [state, dispatch] = useReducer(createUserReducer, {
        firstName: "",
        lastName: "",
        phone: "",
        password: ""
    });

    const update = 
        (field: keyof CreateUserPayload) =>
        (e: React.ChangeEvent<HTMLInputElement>) =>
        dispatch({ field, value: e.target.value });

    const updatePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        if (value.length > 13) return;

        if (value.length == 4 || value.length == 8) {
            value += "-";
        };

        dispatch({ field: "phone", value });
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setIsLoading(false);
    };

    return (
        <div className="h-full relative flex-center flex-col p-10">
            <div className="absolute top-4 left-4">
                <Link href="/" className="flex items-center gap-x-1.5 text-secondary hover:text-secondary/75 transition-all">
                    <FaArrowLeft className="size-3"/>
                    <span className="font-medium text-sm">Back to home</span>
                </Link>
            </div>
            <form className="w-full" onSubmit={handleSubmit}>
                <Logo/>
                <h1 className="font-semibold text-3xl w-full mt-4">Create a user account <br/> with Hagz</h1>
                <p className="text-gray-500 text-sm mt-2">Book grounds for yourself and your friends, explore pitches, track your booking history, and make weekly recurring bookings.</p>
                <div className="flex flex-col gap-y-4 my-10">
                    <div className="flex items-center gap-x-4">
                        <InputGroup className="flex-1" label="First Name" type="text" placeholder="First Name" value={state.firstName} onChange={update("firstName")} />
                        <InputGroup className="flex-1" label="Last Name" type="text" placeholder="Last Name" value={state.lastName} onChange={update("lastName")} />
                    </div>
                    <InputGroup className="flex-1" label="Phone Number" type="text" placeholder="Phone" value={state.phone} onChange={updatePhone} />
                    <InputGroup className="flex-1" label="Password" type="password" placeholder="Password" value={state.password} onChange={update("password")} />
                </div>
                <div className="w-full flex-center">
                    <Button variant="primary" type="submit">
                        <span className="text-xxs font-medium">Sign Up</span>
                    </Button>
                </div>
            </form>
            <span className="absolute bottom-6 right-6 text-gray-600 text-xs">© Hagz 2026</span>
        </div>
    )
}