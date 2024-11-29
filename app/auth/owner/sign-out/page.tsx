"use client";

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation";
import Loading from "@/components/ui/Loading";

export default function SignOut () {
    const router = useRouter();
    const [error, setError] = useState(''); 
    const [message, setMessage] = useState(''); 

    useEffect(() => {
        const signOutRequest = async () => {
            const request = await fetch('/api/auth/owner/sign-out', {
                method: 'POST',
                credentials: 'include'
            })
            
            const data = await request.json();

            if (data.message) {
                setMessage(data.message);
            }

            if (request.status != 200) {
                setError("An error occurred while logging out. Please refresh and try again.");
                return;
            }

            router.push('/auth/owner/sign-in');
        }

        signOutRequest();
    }, [])

    return (
        <div className="flex-center h-screen text-sm">
            {
                error ?
                <div className="flex flex-col gap-y-2 text-center px-4">
                    <span>{error}</span>
                    <span className="text-red-600">{message}</span>
                </div> :
                <Loading/>
            }
        </div>
    )
}