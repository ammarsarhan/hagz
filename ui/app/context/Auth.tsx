"use client";

import { createContext, ReactNode, useContext } from "react"
import { User } from "@/app/utils/types/user";

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

export function AuthContextProvider({ children, user } : { children: ReactNode, user: User | null }) {
    return (
        <AuthContext.Provider value={{ user }}>
            {children}
        </AuthContext.Provider>
    )
}