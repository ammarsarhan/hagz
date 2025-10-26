"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/app/components/base/Button";
import { formatTime } from "@/app/utils/date";

export default function Form({ status, message, resend } : { status: number, message: string, resend: number | null }) {
    const router = useRouter();

    const [disabled, setDisabled] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(resend);
    const [error, setError] = useState<string | null>(null);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Timer to count down the value we get initially, 
    // to use as a very approximate value to the time left on the backend.
    useEffect(() => {
        // Only start the timer if countdown exists and is greater than 0
        if (countdown === null || countdown <= 0) {
            setDisabled(false);
            return;
        };

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearInterval(timer);
                    setDisabled(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Clean up on unmount or when countdown changes.
        return () => clearInterval(timer);
    }, [countdown]);

    // If the user status should not allow them to reach this part, then they will get a screen that won't allow them to send requests.
    if (status == 403) {
        return (
            <div className="relative h-screen flex flex-col items-center justify-center gap-y-4 text-sm text-center px-4">
                <div className="flex flex-col gap-y-1.5">
                    <h1 className="text-xl font-semibold">Verify Your Account</h1>
                    <p className="text-gray-500">{message}</p>
                </div>
                <span className="absolute bottom-6 right-6 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
            </div>
        )
    };

    // Fallback for unexpected status codes.
    if (status !== 200 && status !== 403) {
        return (
            <div className="flex items-center justify-center h-screen w-screen text-center">
                <p className="text-gray-500">An unexpected error has occurred while verifying. <br/> Please sign-in and retry again, if the issue still persists, contact customer support with the following message: {status}</p>
            </div>
        )
    };

    // Implement a set error with timeout function.
    const setErrorWithTimeout = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setError("");
        }, 3000);
    };

    const handleSendEmail = async () => {
        const target = `${process.env.NEXT_PUBLIC_API_URL}/auth/verify/send`;

        const res = await fetch(target, 
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
            }
        );

        if (res.status === 401) {
            router.push('/auth/sign-in');
        };

        const data = await res.json();
        console.log(data);

        // General error case, do not set a timeout yet.
        if (!res.ok) {
            setErrorWithTimeout(data.message);
            return;
        };

        // If the response is ok, disable button and start countdown.
        setCountdown(data.resend);
        setDisabled(true);
    };

    return (
        <div className="h-screen flex flex-col items-center justify-center gap-y-4 text-sm text-center px-4 relative">
            <p className="text-red-500 my-4">{error}</p>
            <div className="flex flex-col gap-y-1.5">
                <h1 className="text-xl font-semibold">Verify Your Email</h1>
                <p className="text-gray-500 text-[0.8125rem]">A link will be sent to the email used to sign up this account. Use that link to verify your email.</p>
            </div>
            <Button onClick={handleSendEmail} disabled={disabled} className="text-xs">
                {
                    countdown ?
                    `Resend in ${formatTime(countdown)}` :
                    "Send verification link"
                }
            </Button>
            <span className="absolute bottom-6 right-6 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
        </div>
    );
}