"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import UserType from "@/types/user";

interface AuthContextType {
    user: UserType | null,
    signInWithCredentials: (email: string, password: string) => Promise<any>
    signOut: () => Promise<any>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
    const context = useContext(AuthContext) as AuthContextType;

    if (!context) {
        throw new Error("useAuthContext must be used within an AuthContextProvider");
    }

    return context;
}

export default function AuthContextProvider({ children } : { children: ReactNode }) {
    const [user, setUser] = useState<UserType | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshTokens = async () => {
        try {
            setLoading(true);

            await fetch("http://localhost:3000/api/refresh/user", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "include"
            });

            setLoading(false);
        } catch (error: any) {
            console.log(error.message);
        }
    }

    const fetchUser = async () => {
        try {
            setLoading(true);
            await refreshTokens();

            const res = await fetch("http://localhost:3000/api/user", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "include"
            })

            const result = await res.json();
            setUser(result.data);

            setLoading(false);
        } catch (error: any) {
            console.log(error.message);
        };
    }

    useEffect(() => {
        fetchUser();
    }, [])

    const signInWithCredentials = async (email: string, password: string) => {
        try {
            const res = await fetch("http://localhost:3000/api/auth/user/sign-in", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });

            const result = await res.json();
            
            if (!result.success) {
                return result;
            }

            if (result.data.status == "SUSPENDED" || result.data.status == "DELETED") {
                return result;
            }

            setUser(result.data);
            return result;
        } catch (error: any) {
            console.log(error.message);
        }
    };

    const signOut = async () => {
        try {
            const res = await fetch("http://localhost:3000/api/auth/sign-out", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "include"
            })
            const data = await res.json();

            if (!data.success) {
                alert("Handle this by making a global modal component that takes in an error message.");
                return;
            };

            setUser(null);
        } catch (error: any) {
            console.log(error.message);
        }
    }

    return (
        <AuthContext.Provider value={{ user, signInWithCredentials, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
