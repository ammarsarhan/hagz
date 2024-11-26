"use client";

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation";
import Loading from "@/components/ui/Loading";

export default function SignOut () {
    const router = useRouter();
    const [error, setError] = useState('');

    useEffect(() => {
        const signOutRequest = async () => {
            const request = await fetch('/api/auth/owner/sign-out', {
                method: 'POST',
                credentials: 'include'
            })

            if (request.status != 200) {
                setError("An error occurred while logging out. Please try again.");
            }

            router.push('/auth/owner/sign-in');
        }

        signOutRequest();
    }, [])

    return (
        <div className="flex-center h-screen text-sm">
            {
                error ?
                <span>{error}</span> :
                <Loading/>
            }
        </div>
    )
}