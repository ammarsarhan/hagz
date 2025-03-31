"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import UserType from "@/types/user";

interface AuthContextType {
    user: UserType | null,
    owner: UserType | null,
    signInWithCredentials: (email: string, password: string, isOwner?: boolean) => Promise<any>
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
    const [owner, setOwner] = useState<UserType | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        try {
            setLoading(true);

            const res = await fetch("http://localhost:3000/api/auth/session", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "include"
            });

            const result = await res.json();

            if (!result.success) {
                setLoading(false);
                return;
            };

            if (result.data.user && result.data.user.status !== "SUSPENDED" && result.data.user.status != "DELETED") {
                setUser(result.data.user);
                setOwner(null);
                setLoading(false);
                return;
            }

            if (result.data.owner && result.data.owner.status !== "SUSPENDED" && result.data.owner.status != "DELETED") {
                setOwner(result.data.owner);
                setUser(null);
                setLoading(false);
                return;
            }

            setLoading(false);
        } catch (error: any) {
            console.log(error.message);
        }
    }

    useEffect(() => {
        refreshUser();
    }, [])

    const signInWithCredentials = async (email: string, password: string, isOwner?: boolean) => {
        try {
            const res = await fetch(`http://localhost:3000/api/auth/${isOwner ? "owner" : "user"}/sign-in`, {
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

            if (isOwner) {
                setOwner(result.data);
            } else {
                setUser(result.data);
            };

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
                return;
            };

            setUser(null);
            setOwner(null);
        } catch (error: any) {
            console.log(error.message);
        }
    }

    return (
        <AuthContext.Provider value={{ user, owner, signInWithCredentials, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
