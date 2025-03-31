"use client";

import { useAuthContext } from "@/context/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react"

export default function SignOut() {
    const { signOut } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        signOut();
        router.back();
    }, [router, signOut]);

    return (
        <div className="h-screen w-screen fixed top-0 left-0 flex-center">
        </div>
    )
}