"use client";

import { FormEvent, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import z from "zod";

import Button from "@/app/components/base/Button";
import Input from "@/app/components/dashboard/Input";
import { signInWithCredentials, SignInPayloadType } from "@/app/utils/api/client";
import Link from "next/link";

const schema = z.object({
    email: z
        .email({ error: "Please enter a valid email address." }),
    password: z
        .string({ error: "Please enter a valid password." })
        .nonempty({ error: "Please enter a valid password" })
        .min(8, { error: "Please enter a valid password." })
});

export default function Form() {    
    const router = useRouter();
    const params = useSearchParams();

    const callback = params.get("callback");
    let redirectPath = callback ? decodeURIComponent(callback) : "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const mutation = useMutation({
        mutationKey: ['auth'],
        mutationFn: (payload: SignInPayloadType) => signInWithCredentials(payload),
        onError: (error) => {
            setErrorWithTimeout(error.message);
        },
        onSuccess: (data) => {
            if (!callback) redirectPath = data.redirectPath;
            router.push(redirectPath);
        }
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
        const parsed = schema.safeParse({ email, password });

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
        <div className="h-screen grid grid-cols-2 gap-x-4 p-4">
            <div className="relative flex flex-col items-center justify-center gap-y-8">
                <div className="flex flex-col gap-y-0.5 text-center">
                    <h1 className="text-xl font-medium">Sign In To Hagz</h1>
                    <p className="text-gray-500 text-[0.8125rem] w-96">Sign back in to book pitches, help manage grounds, or maintain your pitches.</p>
                </div>
                <form className="max-w-xl w-full px-8" onSubmit={handleSubmit}>
                    { error && <p className="text-[0.8125rem] text-red-500 mb-6">{error}</p> }
                    <div className="flex flex-col gap-y-4 text-[0.8125rem]">
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
                        <Button type="submit" className="bg-black! hover:bg-gray-800! border-black! hover:border-gray-800! text-white px-10!">
                            <span className="text-[0.8125rem]">Sign In</span>
                        </Button>
                    </div>
                </form>
                <span className="absolute bottom-4 text-[0.8125rem] text-gray-500">Don&apos;t have an account? <Link href="/auth/sign-up" className="text-blue-700 hover:underline">Sign up</Link></span>
            </div>
            <div className="h-full bg-black rounded-xl"></div>
        </div>
    );
};
