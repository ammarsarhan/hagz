"use client";

import { FormEvent, useRef, useState } from "react";
import { useAuthContext } from "@/context/auth"
import { InputGroup } from "@/components/input";
import Button from "@/components/button";
import Link from "next/link";
import { z } from "zod";
import { useRouter } from "next/navigation";

export default function Signin() {
    const { signInWithCredentials } = useAuthContext();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [reveal, setReveal] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const setErrorWithTimeout = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        };
    
        timeoutRef.current = setTimeout(() => {
            setError(null);
        }, 3000);
    }

    const schema = z.object({
        email: z.string().nonempty("Please provide a valid email.").email("Please provide a valid email/password combination."),
        password: z.string().nonempty("Please provide a password.").min(8, { message: "Please provide a valid email/password combination." })
    })

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const parsed = schema.safeParse({ email, password });

        if (!parsed.success) {
            setErrorWithTimeout(parsed.error.errors[0].message);
            setLoading(false);
            return;
        }

        const res = await signInWithCredentials(parsed.data.email, parsed.data.password);

        if (!res.success) {
            setErrorWithTimeout(res.message);
            setLoading(false);
            return;
        };

        if (res.data.status == "SUSPENDED" || res.data.status == "DELETED") {
            setErrorWithTimeout("This account has either been suspended or deleted. Please contact customer support for more information.");
            setLoading(false);
            return;
        }

        router.push('/');
    }

    return (
        <div className="grid grid-cols-2 h-screen">
            <form className="flex-center flex-col gap-y-6 h-full border-r-[1px] px-8" onSubmit={onSubmit}>
                <span className="text-sm text-center text-red-500">{error}</span>
                <div className="flex-center flex-col text-center">
                    <h1 className="text-2xl mb-2">Sign In to Hagz</h1>
                    <p className="text-sm text-gray-500">Log back in to Hagz as a user to continue finding and reserving pitches!</p>
                </div>
                <div className="w-full">
                    <InputGroup 
                        label="Email" 
                        placeholder="Email Address" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        className="mb-4"
                    />
                    <InputGroup 
                        label="Password" 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        type={reveal ? "text" : "password"}
                    />
                </div>
                <div className="flex items-center w-full">
                    <input type="checkbox" className="mr-2" checked={reveal} onChange={() => setReveal(!reveal)}/>
                    <span className="text-sm" onClick={() => setReveal(!reveal)}>Show Password</span>
                </div>
                <Button className="w-1/3 py-3 text-sm" disabled={loading}>{loading ? "Loading..." : "Sign in"}</Button>
                <span className="text-sm text-gray-500 mt-4">Don&apos;t have an account? Create one now! <Link href="/auth/user/sign-up" className="text-blue-900">Sign up.</Link></span>
            </form>
            <div>

            </div>
        </div>
    )
}