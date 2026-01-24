"use client";

import { createContext, ReactNode, useContext } from "react"
import { useQuery } from "@tanstack/react-query";

import ErrorView from "@/app/components/base/ErrorView";
import keys from "@/app/utils/api/keys";
import { query } from "@/app/utils/api/base";
import { User } from "@/app/utils/types/user";
import { RequestError } from "@/app/utils/api/error";

import { FaExclamation } from "react-icons/fa6";

interface AuthContextType {
    user: User | null;
};

type AuthSessionResponse = AuthContextType;

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function useAuthContext() {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error("useAuthContext must be initialized within an AuthContext.");
    };

    return context;
};

export function AuthContextProvider({ children } : { children: ReactNode }) {
    let user: User | null = null;

    try {
        const response = useQuery<AuthSessionResponse>({
            queryKey: keys.session,
            queryFn: async () => await query('/auth/session'),
            retry: false
        });

        if (response.data) user = response.data.user;
    } catch (error: unknown) {
        const { status, message } = error as RequestError;
        console.log(status, message);
    };

    return (
        <AuthContext.Provider value={{ user }}>
            {children}
        </AuthContext.Provider>
    )
}