"use client"
import { OwnerAccessTokenType } from "@/utils/types/tokens"
import { decode } from "jsonwebtoken"
import { createContext, ReactNode, useState, useContext, useEffect } from "react"
import { useRouter } from "next/navigation"
import Loading from "@/components/ui/Loading"

export interface AuthUser {
    name: string
    email: string
    id: string
}

interface AuthContextDataType {
    accessToken: string | null
    user: AuthUser | null
    role: "Owner" | "User" | undefined,
    loading: boolean
}

interface AuthContextActionsType {
    setAccessToken: (token: string) => void,
    setUser: (user: AuthUser) => void,
    setRole: (role: "Owner" | "User") => void,
    setLoading: (loading: boolean) => void
}

interface AuthContextType {
    data: AuthContextDataType,
    actions: AuthContextActionsType
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function useAuthContext() {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error("useAuthContext must be initialized with an AuthContext");
    }

    return context;
}

export function AuthContextProvider({children} : {children: ReactNode}) {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [userData, setUserData] = useState<AuthUser | null>(null);
    const [role, setRole] = useState<"Owner" | "User" | undefined>(undefined);

    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const requestAccessToken = async () => {
            const request = await fetch('/api/auth/owner/refresh', {
                method: 'POST',
                credentials: 'include'
            })

            const response = await request.json();

            if (!response.token) {
                router.push('/auth/owner/sign-in');
                setLoading(false);
                return;
            }

            const decoded = decode(response.token) as OwnerAccessTokenType;

            setAccessToken(response.token);
            setUserData({name: decoded.name, email: decoded.email, id: decoded.id});
            setRole(decoded.role);

            setLoading(false);
        }

        if (accessToken === null) {
            requestAccessToken();
        }
    }, [])

    useEffect(() => {
        console.log("Set new access token:", accessToken)
    }, [accessToken])

    return (
        <AuthContext.Provider value={{
            data: {
                accessToken: accessToken,
                user: userData,
                role: role,
                loading: loading
            },
            actions: {
                setAccessToken: (token: string) => setAccessToken(token),
                setUser: (user: AuthUser) => setUserData(user),
                setRole: (role: "Owner" | "User") => setRole(role),
                setLoading: (loading: boolean) => setLoading(loading)
            }
        }}>
            {
                loading ?
                <div className='w-full h-screen flex-center'>
                    <Loading/>
                </div> : children
            }
        </AuthContext.Provider>
    )
}