"use client";

import { useQueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { signOut } from "@/app/utils/api/client";
import { useEffect, useState } from "react";

export default function SignOut() {
    const queryClient = useQueryClient();
    const [response, setResponse] = useState<string | null>(null);

    useEffect(() => {
        const handleSignOut = async () => {
            const data = await queryClient.fetchQuery({
                queryFn: signOut,
                queryKey: ["session"]
            });

            setResponse(data);
        };

        handleSignOut();
    }, [queryClient])

    if (response) redirect("/");
}