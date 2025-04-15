"use client";

import { useAuthContext } from "@/context/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react"

export default function SignOut() {
    const { signOut } = useAuthContext();
    const router = useRouter();

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setIsVisible(true);
        }, 3000);

        signOut();
        router.push('/');
    }, [router, signOut]);

    return (
        <div className="h-screen w-screen fixed top-0 left-0 flex-center">
            {
                isVisible &&
                <span className="text-gray-500 text-sm">Signing out...</span>
            }
        </div>
    )
}