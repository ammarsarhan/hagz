"use client";

import { FormEvent, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import Button from "@/app/components/base/Button";
import Input from "@/app/components/dashboard/Input";
import { createManager, ManagerPayloadType } from "@/app/utils/api/client";
import { Invitation } from "@/app/utils/types/invitation";
import z from "zod";
import { useRouter } from "next/navigation";

const schema = z.object({
    firstName: z
        .string({ error: "Please enter a valid first name." })
        .min(2, { error: "First name must be at least 2 characters." })
        .max(100, { error: "First name must be at most 100 characters." }),
    lastName: z
        .string({ error: "Please enter a valid last name." })
        .min(2, { error: "Last name must be at least 2 characters." })
        .max(100, { error: "Last name must be at most 100 characters." }),
    email: z
        .email({ error: "Please enter a valid email address." }),
    phone: z
        .string({ error: "Please enter a valid phone number." })
        .optional()
        .refine(val => !val || val.length === 0 || (val.length >= 10 && val.length <= 15), {
            error: "Phone number must be between 10 and 15 characters if provided."
        }),
    password: z
        .string({ error: "Please enter a valid password." })
        .min(8, { error: "Password must be at least 8 characters." })
        .max(100, { error: "Password must be at most 100 characters." })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/, { 
            error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
        }),
    token: z.string()
});

export default function Form({ data } : { data: Omit<Invitation, "email"> }) {
    const token = data.token;
    
    const router = useRouter();

    const [firstName, setFirstName] = useState(data.firstName);
    const [lastName, setLastName] = useState(data.lastName);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const mutation = useMutation({
        mutationKey: ['auth'],
        mutationFn: (payload: ManagerPayloadType) => createManager(payload),
        onError: (error) => {
            setErrorWithTimeout(error.message);
        },
        onSuccess: () => router.push('/dashboard')
    });

    const setErrorWithTimeout = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        };

        timeoutRef.current = setTimeout(() => {
            setError(null);
        }, 3000);
    }

    const setErrorsWithTimeout = (errors: Record<string, string>) => {
        setErrors(errors);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        };

        timeoutRef.current = setTimeout(() => {
            setErrors({});
        }, 3000);
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const parsed = schema.safeParse({ firstName, lastName, email, password, token });

        if (!parsed.success) {
            const errors: Record<string, string> = {};

            parsed.error.issues.forEach((issue) => {
                const path = issue.path.join(".");
                errors[`${path}`] = issue.message;
            });

            setErrorsWithTimeout(errors);
            return;
        };

        mutation.mutate(parsed.data);
    }

    return (
        <form className="max-w-xl w-full px-8" onSubmit={handleSubmit}>
            { error && <p className="text-[0.8125rem] text-red-500 mb-6">{error}</p> }
            <div className="flex flex-col gap-y-4 text-[0.8125rem]">
                <div className="flex gap-x-4">
                    <Input 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        label="First Name"
                        placeholder="First Name"
                        error={errors["firstName"]}
                    />
                    <Input 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        label="Last Name"
                        placeholder="Last Name"
                        error={errors["lastName"]}
                    />
                </div>
                <Input 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    label="Email"
                    placeholder="Email Address"
                    error={errors["email"]}
                />
                <div>
                    <Input 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        label="Password"
                        placeholder="Password"
                        error={errors["password"]}
                        type={showPassword ? "text" : "password"}
                    />
                    <div className="flex items-center gap-x-1.5 mt-3">
                        <input type="checkbox" onChange={() => setShowPassword(prev => !prev)}/>
                        <span>Show Password</span>
                    </div>
                </div>
            </div>
            <div className="w-full flex items-center justify-center mt-8">
                <Button className="bg-black! hover:bg-gray-800! border-black! hover:border-gray-800! text-white px-10!">
                    <span className="text-[0.8125rem]">Sign Up</span>
                </Button>
            </div>
        </form>
    )
}