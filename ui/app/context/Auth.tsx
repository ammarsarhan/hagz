"use client";

import { createContext, ReactNode, useContext } from "react"
import { useQuery } from "@tanstack/react-query";
import { query } from "@/app/utils/api/base";
import keys from "@/app/utils/api/keys";

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
}

interface AuthContextType {
    user: User | null;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function useAuthContext() {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error("useAuthContext must be initialized within an AuthContext.");
    };

    return context;
};

export function AuthContextProvider({ children } : { children: ReactNode }) {
    const session = useQuery({
        queryKey: keys.session,
        queryFn: async () => await query('/auth/session'),
        retry: false,
        staleTime: 1000 * 60 * 5
    });

    const data = session.data as { user: User | null };
    const { user } = data;

    return (
        <AuthContext.Provider value={{ user }}>
            {children}
        </AuthContext.Provider>
    )
}