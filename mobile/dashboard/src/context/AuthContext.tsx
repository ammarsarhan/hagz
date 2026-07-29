import { client } from "@/lib/client";
import { clearTokens, getAccessToken, saveTokens } from "@/lib/storage";
import { User } from "@/lib/types/user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    signOut: () => Promise<void>;
    saveSession: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchSession(): Promise<User | null> {
    const token = await getAccessToken();
    if (!token) return null;

    const res = await client.auth.session.$get();

    if (!res.ok) {
        await clearTokens();
        return null;
    }

    const body = await res.json();
    return body.data.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    const { data: user, isLoading } = useQuery({
        queryKey: ["session"],
        queryFn: fetchSession,
        staleTime: Infinity,
        retry: false,
    });

    const setUser = (user: User | null) => {
        queryClient.setQueryData(["session"], user);
    };

    const saveSession = async (user: User, accessToken: string, refreshToken: string) => {
        await queryClient.cancelQueries();
        await saveTokens(accessToken, refreshToken);

        queryClient.removeQueries({
            predicate: (query) => {
                const key = query.queryKey[0];
                return key !== "session";
            },
        });

        queryClient.setQueryData(["session"], user);
    };

    const signOut = async () => {
        await queryClient.cancelQueries();
        await clearTokens();

        queryClient.removeQueries({
            predicate: (query) => {
                const key = query.queryKey[0];
                return key !== "session";
            },
        });

        queryClient.setQueryData(["session"], null);
    };

    return (
        <AuthContext.Provider
            value={{ user: user ?? null, isLoading, setUser, signOut, saveSession }}
        >
        {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>.");
    return ctx;
}

export function useRequiredAuth() {
    const { user, ...context } = useAuth();
    if (!user) throw new Error("Authenticated user is required");
    return { user, ...context };
}
